import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Database } from '../db';
import { getTransactionsForReview } from '../categorization/reviewQueue';
import { normalizeMerchantNameForFuzzy } from '../categorizers/fuzzyMatcher';
import { insertOverrideRule, applyOverrideRuleToExistingTransactions } from '../db';

export function mountReviewRoutes(router: Router) {
  router.get('/api/review/transactions', async (req: Request, res: Response) => {
    try {
      const db = (req.app as any).locals?.db as Database | undefined;
      if (!db) {
        return res.status(500).json({
          code: 'REVIEW_FETCH_FAILED',
          message: 'Database connection not available.',
        });
      }

      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const maxConfidence = req.query.maxConfidence ? Number(req.query.maxConfidence) : undefined;

      const items = await getTransactionsForReview(db, {
        limit: Number.isFinite(limit) && limit! > 0 ? limit : undefined,
        maxConfidence: Number.isFinite(maxConfidence) && maxConfidence! >= 0 && maxConfidence! <= 1 ? maxConfidence : undefined,
      });

      res.json({
        items,
        count: items.length,
      });
    } catch (err) {
      // Follow the existing error-handling convention in other routes:
      // log the error and return 500 with a code/message.
      console.error('[review] failed to fetch transactions for review', err);
      res.status(500).json({
        code: 'REVIEW_FETCH_FAILED',
        message: 'Konnte zu prüfende Buchungen nicht laden.',
      });
    }
  });

  // GET /api/review/sonstiges-summary
  router.get('/api/review/sonstiges-summary', (req: Request, res: Response) => {
    try {
      const db = (req.app as any).locals?.db as Database | undefined;
      if (!db) return res.status(500).json({ error: 'db unavailable' });

      const daysParam = Number.parseInt(String((req.query as any)?.days ?? '90'), 10);
      const days = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 90;

      // Compute date cutoff
      const cutoffRow = db.prepare(`SELECT date('now', ?) AS d`).get(`-${days} days`) as { d: string };
      const cutoff = cutoffRow?.d;

      // Load candidate transactions
      const rows = db.prepare(`
        SELECT id, bookingDate, amountCents, purpose, counterpartName, payee, memo
        FROM transactions
        WHERE bookingDate >= ?
          AND amountCents < 0
          AND (category = 'other' OR category = 'other_review' OR category IS NULL OR TRIM(category) = '')
          AND (isRefund = 0 OR isRefund IS NULL)
          AND (isRefunded = 0 OR isRefunded IS NULL)
          AND (isInternalTransfer = 0 OR isInternalTransfer IS NULL)
          AND (isReimbursement = 0 OR isReimbursement IS NULL)
          AND (isPassThrough = 0 OR isPassThrough IS NULL)
      `).all(cutoff) as Array<{
        id: number; bookingDate: string; amountCents: number; purpose?: string | null; counterpartName?: string | null; payee?: string | null; memo?: string | null;
      }>;

      type Group = {
        groupId: string;
        displayName: string;
        txIds: number[];
        txCount: number;
        totalExpenseCents: number;
        lastDate: string;
      };

      const groupsMap = new Map<string, Group>();
      let totalSonstigesCents = 0;

      for (const r of rows) {
        const displayRaw = (r.payee ?? r.counterpartName ?? r.purpose ?? r.memo ?? '').trim();
        const normalized = normalizeMerchantNameForFuzzy(displayRaw || (r.purpose ?? '') || '');
        if (!normalized) continue;
        const key = normalized;
        const g = groupsMap.get(key) ?? {
          groupId: key,
          displayName: displayRaw || normalized,
          txIds: [],
          txCount: 0,
          totalExpenseCents: 0,
          lastDate: r.bookingDate,
        };
        g.txIds.push(r.id);
        g.txCount += 1;
        g.totalExpenseCents += Math.abs(r.amountCents ?? 0);
        if (!g.lastDate || r.bookingDate > g.lastDate) g.lastDate = r.bookingDate;
        groupsMap.set(key, g);

        totalSonstigesCents += Math.abs(r.amountCents ?? 0);
      }

      const groups = Array.from(groupsMap.values())
        .sort((a, b) => b.totalExpenseCents - a.totalExpenseCents)
        .map(g => ({
          groupId: g.groupId,
          displayName: g.displayName,
          txCount: g.txCount,
          totalExpenseCents: g.totalExpenseCents,
          lastDate: g.lastDate,
          exampleTransactionId: String(g.txIds[0]),
        }));

      return res.json({ totalSonstigesCents, groups });
    } catch (e: any) {
      console.error('[review] sonstiges-summary failed', e);
      return res.status(500).json({ error: 'sonstiges summary failed' });
    }
  });

  // POST /api/review/sonstiges/apply
  router.post('/api/review/sonstiges/apply', async (req: Request, res: Response) => {
    try {
      const db = (req.app as any).locals?.db as Database | undefined;
      if (!db) return res.status(500).json({ ok: false, error: 'db unavailable' });
      const { groupId, categoryId, createRule, applyToPast } = req.body || {};
      if (typeof groupId !== 'string' || !groupId.trim()) return res.status(400).json({ ok: false, error: 'groupId required' });
      if (typeof categoryId !== 'string' || !categoryId.trim()) return res.status(400).json({ ok: false, error: 'categoryId required' });

      // Recompute matching tx for this group using same logic
      const rows = db.prepare(`
        SELECT id, purpose, counterpartName, payee, memo, bookingDate, amountCents
        FROM transactions
        WHERE amountCents < 0
          AND (category = 'other' OR category = 'other_review' OR category IS NULL OR TRIM(category) = '')
          AND (isRefund = 0 OR isRefund IS NULL)
          AND (isRefunded = 0 OR isRefunded IS NULL)
          AND (isInternalTransfer = 0 OR isInternalTransfer IS NULL)
          AND (isReimbursement = 0 OR isReimbursement IS NULL)
          AND (isPassThrough = 0 OR isPassThrough IS NULL)
      `).all() as Array<{ id: number; purpose?: string | null; counterpartName?: string | null; payee?: string | null; memo?: string | null; bookingDate: string; amountCents: number; }>;

      const matchingIds: number[] = [];
      for (const r of rows) {
        const displayRaw = (r.payee ?? r.counterpartName ?? r.purpose ?? r.memo ?? '').trim();
        const normalized = normalizeMerchantNameForFuzzy(displayRaw || (r.purpose ?? '') || '');
        if (normalized && normalized === groupId) {
          matchingIds.push(r.id);
        }
      }

      if (matchingIds.length === 0) {
        return res.status(404).json({ ok: false, groupId, updatedCount: 0 });
      }

      // Update in batches
      const placeholders = matchingIds.map(() => '?').join(',');
      const updated = db
        .prepare(`UPDATE transactions SET category = ?, category_source = 'user', category_rule_id = ? WHERE id IN (${placeholders})`)
        .run(categoryId, `bulk_sonstiges:${groupId}`, ...matchingIds);

      let ruleId: string | undefined;
      if (createRule) {
        // Derive a simple pattern from the groupId (normalized merchant) - use payee pattern
        const rule = insertOverrideRule(
          {
            id: undefined as any,
            patternType: 'payee',
            pattern: groupId,
            categoryId,
            applyToPast: Boolean(applyToPast),
            createdAt: new Date().toISOString(),
          },
          db,
        );
        ruleId = rule.id;
        if (applyToPast) {
          try {
            await applyOverrideRuleToExistingTransactions(ruleId, db);
          } catch (e) {
            console.warn('[review] applyOverrideRuleToExistingTransactions failed:', (e as Error)?.message || e);
          }
        }
      }

      return res.json({ ok: true, groupId, updatedCount: updated?.changes ?? matchingIds.length, ruleId });
    } catch (e: any) {
      console.error('[review] sonstiges apply failed', e);
      return res.status(500).json({ ok: false, error: 'apply failed' });
    }
  });
}

