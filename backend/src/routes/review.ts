import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Database } from '../db';
import { getTransactionsForReview } from '../categorization/reviewQueue';
import { normalizeMerchantNameForFuzzy } from '../categorizers/fuzzyMatcher';
import { computeReimbursementConfidence } from '../categorization/reimbursementMatcher';
import { insertOverrideRule, applyOverrideRuleToExistingTransactions } from '../db';
import { extractUnderlyingMerchantFromPayPal } from '../categorization/textPreprocessor';
import { isCashWithdrawalLike } from '../categorization/cashMatcher';
import { categorizeTransaction, mapNimbusCategoryToLegacy } from '../categorization';
import { buildCategorizationExplanation } from '../categorization/explanation';
import type { ParsedRow } from '../parsing/types';
import type { CategoryId } from '../types/category';
import { getCategoryDefinition, isValidCategory } from '../config/categories';
import crypto from 'node:crypto';

/**
 * Extract merchant name from comdirect-style "Auftraggeber:" block.
 * For patterns like: "Lastschrift / Belastung | Auftraggeber: Aral Station 141726125 Buchungstext: ..."
 * Returns the merchant name after "Auftraggeber:", or null if pattern not found.
 */
function extractMerchantFromAuftraggeberBlock(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.replace(/\s+/g, ' ').trim();

  // Search for "Auftraggeber:" (case-insensitive, with or without extra spaces)
  const match = t.match(/Auftraggeber:\s*([^|]+?)(?:\s+Buchungstext:|$)/i);
  if (!match || !match[1]) return null;

  let merchant = match[1].trim();

  // Cut off trailing commas / locations only if they are obviously appended
  // Just trim; no heavy logic needed here.
  merchant = merchant.replace(/\s+,/g, ',').trim();

  return merchant.length > 0 ? merchant : null;
}

/**
 * Build a stable group key and display name for Sonstiges wizard grouping.
 * Handles PayPal transactions by extracting underlying merchants,
 * detects cash withdrawals, and falls back to normalized merchant names.
 */
function buildSonstigesGroupKey(row: {
  id: number;
  purpose?: string | null;
  counterpartName?: string | null;
  payee?: string | null;
  memo?: string | null;
}): { groupId: string; displayName: string } {
  // Combine all text fields for analysis
  const rawCounterpart = (row.counterpartName ?? '').trim();
  const rawPayee = (row.payee ?? '').trim();
  const rawPurpose = (row.purpose ?? '').trim();
  const rawMemo = (row.memo ?? '').trim();
  const combinedText = [rawCounterpart, rawPayee, rawPurpose, rawMemo].filter(Boolean).join(' ');

  // Check for cash withdrawals using centralized helper
  // Note: This is just for grouping in the wizard - cash withdrawals are excluded from Sonstiges queries
  const isCashWithdrawal = isCashWithdrawalLike(rawPurpose, rawMemo);
  
  if (isCashWithdrawal) {
    // Extract bank name if present
    const bankMatch = combinedText.match(/DEUTSCHE\s+BANK|SPARKASSE|COMDIRECT|ING|DKB/i);
    const bankName = bankMatch ? bankMatch[0].toLowerCase().replace(/\s+/g, '-') : 'unknown';
    return {
      groupId: `cash:${bankName}-atm`,
      displayName: rawCounterpart || rawPayee || rawPurpose || 'Bargeldauszahlung',
    };
  }

  // Check for PayPal transactions
  const isPayPal = /PAYPAL/i.test(rawCounterpart) || /PAYPAL/i.test(rawPayee) || /PAYPAL/i.test(rawPurpose) || /PAYPAL/i.test(rawMemo);

  if (isPayPal) {
    // Try to extract underlying merchant from PayPal transaction text
    const underlyingMerchant = extractUnderlyingMerchantFromPayPal(combinedText);
    
    if (underlyingMerchant && underlyingMerchant.trim().length > 0) {
      const normalized = normalizeMerchantNameForFuzzy(underlyingMerchant);
      if (normalized && normalized.trim().length > 0) {
        // Group by normalized underlying merchant with PayPal namespace
        return {
          groupId: `paypal:${normalized}`,
          displayName: underlyingMerchant.trim(),
        };
      }
    }

    // If we cannot find an underlying merchant, fall back to 1 tx = 1 group
    // Use transaction id for stable unique grouping
    return {
      groupId: `tx:${row.id}`,
      displayName: rawCounterpart || rawPayee || rawPurpose || rawMemo || 'Unbekannter PayPal-Händler',
    };
  }

  // Non-PayPal, non-cash: extract merchant candidate in priority order
  // 1. payee (if present and non-empty)
  // 2. counterpartName (if present)
  // 3. extractMerchantFromAuftraggeberBlock(purpose) - for comdirect card transactions
  // 4. extractMerchantFromAuftraggeberBlock(memo) - just in case
  // 5. Fallback to raw purpose/memo/counterpart
  let merchantCandidate: string | null = null;
  if (rawPayee && rawPayee.trim().length > 0) {
    merchantCandidate = rawPayee.trim();
  } else if (rawCounterpart && rawCounterpart.trim().length > 0) {
    merchantCandidate = rawCounterpart.trim();
  } else {
    merchantCandidate = extractMerchantFromAuftraggeberBlock(row.purpose) || extractMerchantFromAuftraggeberBlock(row.memo) || null;
  }
  
  // Fallback to raw purpose/memo if Auftraggeber extraction didn't work
  if (!merchantCandidate) {
    merchantCandidate = (rawPurpose && rawPurpose.trim().length > 0 ? rawPurpose.trim() : null) ||
      (rawMemo && rawMemo.trim().length > 0 ? rawMemo.trim() : null) ||
      (rawCounterpart && rawCounterpart.trim().length > 0 ? rawCounterpart.trim() : null) ||
      'Sonstiges';
  }

  const normalized = normalizeMerchantNameForFuzzy(merchantCandidate);
  
  if (!normalized || normalized.trim().length === 0) {
    // Fallback to transaction-specific group if normalization fails
    return {
      groupId: `tx:${row.id}`,
      displayName: merchantCandidate || 'Sonstiges',
    };
  }

  return {
    groupId: `m:${normalized}`,
    displayName: merchantCandidate || normalized,
  };
}

/**
 * Convert a database row to a ParsedRow for categorization.
 */
function dbRowToParsedRow(row: {
  id: number;
  bookingDate: string;
  amountCents: number;
  purpose?: string | null;
  counterpartName?: string | null;
  payee?: string | null;
  memo?: string | null;
  valueDate?: string | null;
  currency?: string | null;
  accountIban?: string | null;
  counterpartyIban?: string | null;
  bankProfile?: string | null;
}): ParsedRow {
  const direction: ParsedRow['direction'] = row.amountCents >= 0 ? 'in' : 'out';
  const rawText = [row.purpose, row.memo, row.payee, row.counterpartName].filter(Boolean).join(' ') || '';
  
  return {
    bookingDate: row.bookingDate,
    valutaDate: row.valueDate ?? row.bookingDate,
    amountCents: row.amountCents,
    currency: (row.currency ?? 'EUR').toUpperCase(),
    direction,
    accountId: row.accountIban ?? 'account:unknown',
    accountIban: row.accountIban ?? null,
    counterparty: row.counterpartName ?? row.payee ?? null,
    counterpartyIban: row.counterpartyIban ?? null,
    mcc: null,
    reference: null,
    externalId: null,
    rawText,
    normalizedText: undefined,
    categorySystem: undefined,
    raw: {
      __source: 'sonstiges_suggestion',
      purpose: row.purpose,
      memo: row.memo,
      payee: row.payee,
      counterpartName: row.counterpartName,
      bankProfile: row.bankProfile,
    },
    // Ensure flags are explicitly set to avoid false positives
    isRefund: false,
    isRefunded: false,
    isInternalTransfer: false,
    isReimbursement: false,
    isCashWithdrawal: false,
  };
}

type SonstigesSuggestion = {
  nimbusCategoryId: string | null;
  legacyCategoryId: CategoryId | null;
  source: string | null;
  reasonCode: string | null;
  reasonText: string | null;
  confidence: number | null;
};

/**
 * Compute a suggested category for a Sonstiges merchant group.
 * Samples transactions from the group and categorizes them to find the best match.
 */
function buildSonstigesSuggestionForGroup(
  db: Database,
  groupId: string,
  cutoffDate: string | null,
): SonstigesSuggestion | null {
  try {
    // 1) Find sample rows for this group (max 10 rows for efficiency)
    const sampleRows = db.prepare(`
      SELECT id, bookingDate, valueDate, amountCents, currency, purpose, counterpartName, payee, memo, accountIban, counterpartyIban, bankProfile
      FROM transactions
      WHERE bookingDate >= COALESCE(?, '1970-01-01')
        AND amountCents < 0
        AND (category = 'other' OR category = 'other_review' OR category IS NULL OR TRIM(category) = '')
        AND (isRefund = 0 OR isRefund IS NULL)
        AND (isRefunded = 0 OR isRefunded IS NULL)
        AND (isInternalTransfer = 0 OR isInternalTransfer IS NULL)
        AND (isReimbursement = 0 OR isReimbursement IS NULL)
        AND (isPassThrough = 0 OR isPassThrough IS NULL)
        AND (isCashWithdrawal = 0 OR isCashWithdrawal IS NULL)
      ORDER BY bookingDate DESC
      LIMIT 50
    `).all(cutoffDate) as Array<{
      id: number;
      bookingDate: string;
      valueDate?: string | null;
      amountCents: number;
      currency?: string | null;
      purpose?: string | null;
      counterpartName?: string | null;
      payee?: string | null;
      memo?: string | null;
      accountIban?: string | null;
      counterpartyIban?: string | null;
      bankProfile?: string | null;
    }>;

    // Filter to rows that match this groupId using buildSonstigesGroupKey
    const matchingRows = sampleRows.filter(r => {
      const { groupId: computedGroupId } = buildSonstigesGroupKey(r);
      return computedGroupId === groupId;
    });

    if (matchingRows.length === 0) {
      return null;
    }

    // Take up to 10 samples (or all if fewer)
    const samples = matchingRows.slice(0, 10);

    // 2) Categorize each sample row
    type CategorizationResult = {
      nimbusCategory: string;
      legacyCategory: CategoryId;
      confidence: number;
      source: string;
      reasonCode: string;
      reasonText: string;
    };

    const results: CategorizationResult[] = [];

    for (const row of samples) {
      const parsedRow = dbRowToParsedRow(row);
      const categorized = categorizeTransaction(parsedRow);
      
      const nimbusCategory = categorized.category ?? 'other';
      const legacyCategory = mapNimbusCategoryToLegacy(nimbusCategory);
      const confidence = categorized.categoryConfidence ?? 0;
      const source = categorized.categorySource ?? 'unknown';

      // Filter out unsuitable categories:
      // - 'other' / 'other_review' / empty
      // - internal transfers / cash withdrawals
      // - Income categories for expense transactions (shouldn't happen but guard against it)
      if (nimbusCategory === 'other' || 
          nimbusCategory === 'other_review' || 
          nimbusCategory.startsWith('internal:') ||
          nimbusCategory === 'cash:withdrawal' ||
          legacyCategory === 'transfer_internal' ||
          legacyCategory === 'cash_withdrawal' ||
          (row.amountCents < 0 && nimbusCategory.startsWith('income:')) ||
          confidence < 0.7) { // Minimum confidence threshold
        continue;
      }

      // Build explanation
      const explanation = buildCategorizationExplanation({
        id: String(row.id),
        bookingDate: row.bookingDate,
        amountCents: row.amountCents,
        currency: row.currency ?? 'EUR',
        direction: parsedRow.direction,
        rawText: parsedRow.rawText,
        bankProfile: row.bankProfile ?? 'bank',
        category: legacyCategory,
        categoryConfidence: confidence,
        categorySource: source as any,
        categoryRuleId: categorized.categoryExplanation?.ruleId,
        isRefund: false,
        isRefunded: false,
        isInternalTransfer: false,
        isReimbursement: false,
      } as any);

      results.push({
        nimbusCategory,
        legacyCategory,
        confidence,
        source,
        reasonCode: explanation.code,
        reasonText: explanation.text,
      });
    }

    if (results.length === 0) {
      return null;
    }

    // 3) Pick the best candidate:
    //    - Category that appears most often
    //    - Break ties by highest average confidence
    const categoryCounts = new Map<string, { count: number; totalConfidence: number; results: CategorizationResult[] }>();
    
    for (const result of results) {
      const key = result.nimbusCategory; // Use Nimbus category as key for grouping
      const existing = categoryCounts.get(key) ?? { count: 0, totalConfidence: 0, results: [] };
      existing.count += 1;
      existing.totalConfidence += result.confidence;
      existing.results.push(result);
      categoryCounts.set(key, existing);
    }

    // Find category with highest count, then highest average confidence
    let bestCategory: string | null = null;
    let bestCount = 0;
    let bestAvgConfidence = 0;

    for (const [category, stats] of categoryCounts.entries()) {
      const avgConfidence = stats.totalConfidence / stats.count;
      const isBetter = 
        stats.count > bestCount || 
        (stats.count === bestCount && avgConfidence > bestAvgConfidence);
      
      if (isBetter) {
        bestCategory = category;
        bestCount = stats.count;
        bestAvgConfidence = avgConfidence;
      }
    }

    if (!bestCategory || bestCount < 1) {
      return null;
    }

    // Get representative result for the best category
    const bestStats = categoryCounts.get(bestCategory)!;
    const representative = bestStats.results[0]; // Use first result for reason text

    return {
      nimbusCategoryId: bestCategory,
      legacyCategoryId: mapNimbusCategoryToLegacy(bestCategory),
      source: representative.source,
      reasonCode: representative.reasonCode,
      reasonText: representative.reasonText,
      confidence: bestAvgConfidence,
    };
  } catch (err) {
    console.warn('[review] buildSonstigesSuggestionForGroup failed for groupId:', groupId, err);
    return null;
  }
}

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
          AND (isCashWithdrawal = 0 OR isCashWithdrawal IS NULL)
      `).all(cutoff) as Array<{
        id: number; bookingDate: string; valueDate?: string | null; amountCents: number; currency?: string | null; purpose?: string | null; counterpartName?: string | null; payee?: string | null; memo?: string | null; accountIban?: string | null; counterpartyIban?: string | null; bankProfile?: string | null;
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
        // Use the new helper function to build group key
        const { groupId, displayName } = buildSonstigesGroupKey(r);
        
        const g = groupsMap.get(groupId) ?? {
          groupId,
          displayName,
          txIds: [],
          txCount: 0,
          totalExpenseCents: 0,
          lastDate: r.bookingDate,
        };
        g.txIds.push(r.id);
        g.txCount += 1;
        g.totalExpenseCents += Math.abs(r.amountCents ?? 0);
        if (!g.lastDate || r.bookingDate > g.lastDate) g.lastDate = r.bookingDate;
        groupsMap.set(groupId, g);

        totalSonstigesCents += Math.abs(r.amountCents ?? 0);
      }

      const groups = Array.from(groupsMap.values())
        .sort((a, b) => b.totalExpenseCents - a.totalExpenseCents)
        .map(g => {
          // Compute suggestion for this group
          const suggestion = buildSonstigesSuggestionForGroup(db, g.groupId, cutoff);
          
          return {
            groupId: g.groupId,
            displayName: g.displayName,
            txCount: g.txCount,
            totalExpenseCents: g.totalExpenseCents,
            lastDate: g.lastDate,
            exampleTransactionId: String(g.txIds[0]),
            suggestedCategoryId: suggestion?.legacyCategoryId ?? null,
            suggestedNimbusCategoryId: suggestion?.nimbusCategoryId ?? null,
            suggestedConfidence: suggestion?.confidence ?? null,
            suggestedReasonText: suggestion?.reasonText ?? null,
          };
        });

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

      // If rule creation requested, check for existing conflicting rule first
      if (createRule) {
        const existing = db.prepare(`SELECT id, categoryId FROM user_override_rules WHERE patternType = 'payee' AND pattern = ? LIMIT 1`).get(groupId) as { id?: string; categoryId?: string } | undefined;
        if (existing && existing.id) {
          return res.status(409).json({
            error: 'rule_conflict',
            message: 'Es existiert bereits eine Regel für diesen Händler.',
            existingRuleId: existing.id,
            existingCategoryId: existing.categoryId ?? null,
          });
        }
      }

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
          AND (isCashWithdrawal = 0 OR isCashWithdrawal IS NULL)
      `).all() as Array<{ id: number; purpose?: string | null; counterpartName?: string | null; payee?: string | null; memo?: string | null; bookingDate: string; amountCents: number; }>;

      const matchingIds: number[] = [];
      for (const r of rows) {
        // Use the same buildSonstigesGroupKey logic to match
        const { groupId: computedGroupId } = buildSonstigesGroupKey(r);
        if (computedGroupId === groupId) {
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
            id: crypto.randomUUID(),
            patternType: 'payee',
            pattern: groupId,
            categoryId: categoryId as any, // categoryId from request body, validated as CategoryId
            applyToPast: Boolean(applyToPast),
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

  // GET /api/review/sonstiges/group/:groupId/transactions?limit=20
  router.get('/api/review/sonstiges/group/:groupId/transactions', (req: Request, res: Response) => {
    try {
      const db = (req.app as any).locals?.db as Database | undefined;
      if (!db) return res.status(500).json({ error: 'db unavailable' });
      const groupId = String(req.params.groupId || '').trim();
      if (!groupId) return res.status(400).json({ error: 'groupId required' });
      const limitParam = Number.parseInt(String((req.query as any)?.limit ?? '20'), 10);
      const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 20;

      const candidates = db.prepare(`
        SELECT id, bookingDate, amountCents, purpose, memo, payee, counterpartName, category, category_source AS categorySource
        FROM transactions
        WHERE amountCents < 0
          AND (category = 'other' OR category = 'other_review' OR category IS NULL OR TRIM(category) = '')
          AND (isRefund = 0 OR isRefund IS NULL)
          AND (isRefunded = 0 OR isRefunded IS NULL)
          AND (isInternalTransfer = 0 OR isInternalTransfer IS NULL)
          AND (isReimbursement = 0 OR isReimbursement IS NULL)
          AND (isPassThrough = 0 OR isPassThrough IS NULL)
          AND (isCashWithdrawal = 0 OR isCashWithdrawal IS NULL)
        ORDER BY bookingDate DESC
      `).all() as Array<{ id: number; bookingDate: string; amountCents: number; purpose?: string | null; memo?: string | null; payee?: string | null; counterpartName?: string | null; category?: string | null; categorySource?: string | null }>;

      const filtered = candidates.filter(r => {
        // Use the same buildSonstigesGroupKey logic to match
        const { groupId: computedGroupId } = buildSonstigesGroupKey(r);
        return computedGroupId === groupId;
      });

      const totalCount = filtered.length;
      const totalExpenseCents = filtered.reduce((acc, r) => acc + Math.abs(r.amountCents || 0), 0);
      const transactions = filtered.slice(0, limit).map(r => ({
        id: String(r.id),
        bookingDate: r.bookingDate,
        amountCents: Math.trunc(r.amountCents ?? 0),
        description: (r.memo ?? r.purpose ?? '') || (r.payee ?? r.counterpartName ?? '') || '',
        currentCategoryId: (r.category ?? null),
        categorySource: (r.categorySource ?? null),
      }));

      return res.json({ transactions, totalCount, totalExpenseCents });
    } catch (e: any) {
      console.error('[review] sonstiges group preview failed', e);
      return res.status(500).json({ error: 'preview failed' });
    }
  });

  // GET /api/review/reimbursements
  router.get('/api/review/reimbursements', (req: Request, res: Response) => {
    try {
      const db = (req.app as any).locals?.db as Database | undefined;
      if (!db) return res.status(500).json({ error: 'db unavailable' });

      // Time window: last 90 days
      const cutoffRow = db.prepare(`SELECT date('now', ?) AS d`).get('-90 days') as { d: string };
      const cutoff = cutoffRow?.d;

      // Load reimbursement transactions (excluding pass-through and ignored)
      const rows = db.prepare(`
        SELECT 
          id,
          bookingDate,
          amountCents,
          purpose,
          memo,
          counterpartName,
          payee,
          category,
          reimbursementGroupId
        FROM transactions
        WHERE bookingDate >= ?
          AND isReimbursement = 1
          AND (isPassThrough = 0 OR isPassThrough IS NULL)
          AND (ignoreForReimbursement = 0 OR ignoreForReimbursement IS NULL)
        ORDER BY bookingDate DESC
      `).all(cutoff) as Array<{
        id: number;
        bookingDate: string;
        amountCents: number;
        purpose: string | null;
        memo: string | null;
        counterpartName: string | null;
        payee: string | null;
        category: string | null;
        reimbursementGroupId: string | null;
      }>;

      // Also load potential expense transactions for pairing (last 90 days, negative amounts, not pass-through, not ignored)
      const expenseRows = db.prepare(`
        SELECT 
          id,
          bookingDate,
          amountCents,
          purpose,
          memo,
          counterpartName,
          payee,
          category,
          reimbursementGroupId
        FROM transactions
        WHERE bookingDate >= ?
          AND amountCents < 0
          AND (isPassThrough = 0 OR isPassThrough IS NULL)
          AND (ignoreForReimbursement = 0 OR ignoreForReimbursement IS NULL)
        ORDER BY bookingDate DESC
      `).all(cutoff) as Array<{
        id: number;
        bookingDate: string;
        amountCents: number;
        purpose: string | null;
        memo: string | null;
        counterpartName: string | null;
        payee: string | null;
        category: string | null;
        reimbursementGroupId: string | null;
      }>;

      // Group by reimbursementGroupId or fallback to normalized counterpartName
      type GroupData = {
        groupId: string;
        counterpartName: string | null;
        transactions: Array<{
          id: number;
          bookingDate: string;
          amountCents: number;
          purpose: string | null;
          memo: string | null;
          category: string | null;
          counterpartName: string | null;
          payee: string | null;
        }>;
      };

      const groupsMap = new Map<string, GroupData>();

      for (const row of rows) {
        // Prefer reimbursementGroupId if present
        let groupId: string;
        let counterpartName: string | null = row.counterpartName ?? row.payee ?? null;

        if (row.reimbursementGroupId) {
          groupId = row.reimbursementGroupId;
        } else {
          // Fallback: normalize counterpartName for grouping
          const normalized = normalizeMerchantNameForFuzzy(counterpartName ?? '');
          groupId = normalized && normalized.trim().length > 0 
            ? `rb_fallback:${normalized}` 
            : `rb_fallback:${row.id}`;
        }

        const group = groupsMap.get(groupId) ?? {
          groupId,
          counterpartName,
          transactions: [],
        };

        group.transactions.push({
          id: row.id,
          bookingDate: row.bookingDate,
          amountCents: row.amountCents,
          purpose: row.purpose,
          memo: row.memo,
          category: row.category,
          counterpartName: row.counterpartName,
          payee: row.payee,
        });

        // Update counterpartName if we have a better one
        if (!group.counterpartName && counterpartName) {
          group.counterpartName = counterpartName;
        }

        groupsMap.set(groupId, group);
      }

      // Build response groups with confidence scores
      const responseGroups = Array.from(groupsMap.values()).map(group => {
        // Separate inflows (positive) and outflows (negative)
        const inflows = group.transactions
          .filter(tx => tx.amountCents > 0)
          .sort((a, b) => b.bookingDate.localeCompare(a.bookingDate))
          .slice(0, 5)
          .map(tx => ({
            id: tx.id,
            bookingDate: tx.bookingDate,
            amountCents: tx.amountCents,
            purpose: tx.purpose,
            category: tx.category,
          }));

        const outflows = group.transactions
          .filter(tx => tx.amountCents < 0)
          .sort((a, b) => b.bookingDate.localeCompare(a.bookingDate))
          .slice(0, 5)
          .map(tx => ({
            id: tx.id,
            bookingDate: tx.bookingDate,
            amountCents: tx.amountCents,
            purpose: tx.purpose,
            category: tx.category,
          }));

        // Calculate totals
        const totalInflowCents = group.transactions
          .filter(tx => tx.amountCents > 0)
          .reduce((sum, tx) => sum + tx.amountCents, 0);

        const totalOutflowCents = Math.abs(
          group.transactions
            .filter(tx => tx.amountCents < 0)
            .reduce((sum, tx) => sum + tx.amountCents, 0)
        );

        // Calculate total underlying expenses for this group
        // Find expenses that match this group (same reimbursementGroupId or same counterpart for fallback)
        let totalExpenseCents = 0;
        const matchingExpenses: Array<{ category: string | null; amountCents: number }> = [];
        
        if (group.groupId.startsWith('rb_fallback:')) {
          // For fallback groups, match by normalized counterpart name
          const normalizedGroupName = group.groupId.replace('rb_fallback:', '');
          for (const expense of expenseRows) {
            const expenseNormalized = normalizeMerchantNameForFuzzy(expense.counterpartName ?? expense.payee ?? '');
            if (expenseNormalized === normalizedGroupName) {
              // Expense amounts are negative, convert to positive cents
              const absAmount = Math.abs(expense.amountCents);
              totalExpenseCents += absAmount;
              matchingExpenses.push({ category: expense.category, amountCents: absAmount });
            }
          }
        } else {
          // For groups with reimbursementGroupId, find expenses with the same groupId
          for (const expense of expenseRows) {
            if (expense.reimbursementGroupId === group.groupId) {
              // Expense amounts are negative, convert to positive cents
              const absAmount = Math.abs(expense.amountCents);
              totalExpenseCents += absAmount;
              matchingExpenses.push({ category: expense.category, amountCents: absAmount });
            }
          }
        }

        // Compute primary category from matching expenses
        let primaryCategoryId: string | null = null;
        let primaryCategoryLabel: string | null = null;
        
        if (matchingExpenses.length > 0) {
          // Group by category and sum absolute amounts
          const categoryTotals = new Map<string, number>();
          for (const expense of matchingExpenses) {
            const cat = expense.category?.trim() || null;
            if (cat && cat !== 'other' && cat !== 'other_review') {
              const current = categoryTotals.get(cat) || 0;
              categoryTotals.set(cat, current + expense.amountCents);
            }
          }
          
          // Find category with highest total
          let maxTotal = 0;
          let maxCategory: string | null = null;
          for (const [category, total] of categoryTotals.entries()) {
            if (total > maxTotal) {
              maxTotal = total;
              maxCategory = category;
            }
          }
          
          // Map to German label if we found a category
          if (maxCategory && isValidCategory(maxCategory)) {
            primaryCategoryId = maxCategory;
            const categoryDef = getCategoryDefinition(maxCategory);
            primaryCategoryLabel = categoryDef.label;
          }
        }

        // Calculate net impact: totalExpenseCents - totalInflowCents + totalOutflowCents
        // If > 0: user paid net (expenses > reimbursements received)
        // If < 0: user received net (reimbursements received > expenses)
        // If ≈ 0: balanced
        const netImpactCents = totalExpenseCents - totalInflowCents + totalOutflowCents;

        // Find most recent booking date
        const lastBookingDate = group.transactions
          .map(tx => tx.bookingDate)
          .sort((a, b) => b.localeCompare(a))[0] || '';

        // Compute confidence: pair reimbursements (inflows) with expenses (outflows or from expenseRows)
        let maxConfidence = 0;
        const reimbursementTxs = group.transactions.filter(tx => tx.amountCents > 0);
        const expenseTxsInGroup = group.transactions.filter(tx => tx.amountCents < 0);

        // Try pairing each reimbursement with expenses in the same group
        for (const reimbursement of reimbursementTxs) {
          // First try expenses in the same group
          for (const expense of expenseTxsInGroup) {
            const confidence = computeReimbursementConfidence({
              expenseRow: {
                amountCents: expense.amountCents,
                bookingDate: expense.bookingDate,
                counterpartName: expense.counterpartName,
                payee: expense.payee,
                purpose: expense.purpose,
                memo: expense.memo,
                category: expense.category,
              },
              reimbursementRow: {
                amountCents: reimbursement.amountCents,
                bookingDate: reimbursement.bookingDate,
                counterpartName: reimbursement.counterpartName,
                payee: reimbursement.payee,
                purpose: reimbursement.purpose,
                memo: reimbursement.memo,
                category: reimbursement.category,
              },
            });
            maxConfidence = Math.max(maxConfidence, confidence.total);
          }

          // Also try pairing with expenses from expenseRows that might match (same groupId or similar counterpart)
          if (group.groupId.startsWith('rb_fallback:')) {
            // For fallback groups, try to find matching expenses by counterpart name
            const normalizedGroupName = group.groupId.replace('rb_fallback:', '');
            for (const expense of expenseRows) {
              const expenseNormalized = normalizeMerchantNameForFuzzy(expense.counterpartName ?? expense.payee ?? '');
              if (expenseNormalized === normalizedGroupName) {
                const confidence = computeReimbursementConfidence({
                  expenseRow: {
                    amountCents: expense.amountCents,
                    bookingDate: expense.bookingDate,
                    counterpartName: expense.counterpartName,
                    payee: expense.payee,
                    purpose: expense.purpose,
                    memo: expense.memo,
                    category: expense.category,
                  },
                  reimbursementRow: {
                    amountCents: reimbursement.amountCents,
                    bookingDate: reimbursement.bookingDate,
                    counterpartName: reimbursement.counterpartName,
                    payee: reimbursement.payee,
                    purpose: reimbursement.purpose,
                    memo: reimbursement.memo,
                    category: reimbursement.category,
                  },
                });
                maxConfidence = Math.max(maxConfidence, confidence.total);
              }
            }
          } else {
            // For groups with reimbursementGroupId, try to find expenses with the same groupId
            for (const expense of expenseRows) {
              if (expense.reimbursementGroupId === group.groupId) {
                const confidence = computeReimbursementConfidence({
                  expenseRow: {
                    amountCents: expense.amountCents,
                    bookingDate: expense.bookingDate,
                    counterpartName: expense.counterpartName,
                    payee: expense.payee,
                    purpose: expense.purpose,
                    memo: expense.memo,
                    category: expense.category,
                  },
                  reimbursementRow: {
                    amountCents: reimbursement.amountCents,
                    bookingDate: reimbursement.bookingDate,
                    counterpartName: reimbursement.counterpartName,
                    payee: reimbursement.payee,
                    purpose: reimbursement.purpose,
                    memo: reimbursement.memo,
                    category: reimbursement.category,
                  },
                });
                maxConfidence = Math.max(maxConfidence, confidence.total);
              }
            }
          }
        }

        // If no pairs found, use a default low confidence
        if (maxConfidence === 0 && group.transactions.length > 0) {
          maxConfidence = 30; // Default low confidence for unpaired groups
        }

        // Load allocations for this group
        const allocations = db.prepare(`
          SELECT id, inflowTransactionId, expenseTransactionId, allocatedAmountCents
          FROM reimbursement_allocations
          WHERE groupId = ?
        `).all(group.groupId) as Array<{
          id: number;
          inflowTransactionId: string;
          expenseTransactionId: string;
          allocatedAmountCents: number;
        }>;

        return {
          groupId: group.groupId,
          counterpartName: group.counterpartName,
          txCount: group.transactions.length,
          totalInflowCents,
          totalOutflowCents,
          totalExpenseCents,
          netImpactCents,
          lastBookingDate,
          confidence: maxConfidence,
          inflows,
          outflows,
          primaryCategoryId,
          primaryCategoryLabel,
          allocations: allocations.map(a => ({
            id: a.id,
            inflowTransactionId: String(a.inflowTransactionId),
            expenseTransactionId: String(a.expenseTransactionId),
            allocatedAmountCents: a.allocatedAmountCents,
          })),
        };
      });

      // Sort by lastBookingDate descending
      responseGroups.sort((a, b) => b.lastBookingDate.localeCompare(a.lastBookingDate));

      return res.json({ groups: responseGroups });
    } catch (e: any) {
      console.error('[review] reimbursements endpoint failed', e);
      return res.status(500).json({ error: 'Failed to load reimbursement groups' });
    }
  });

  // POST /api/review/reimbursements/:groupId/ignore
  router.post('/api/review/reimbursements/:groupId/ignore', (req: Request, res: Response) => {
    try {
      const db = (req.app as any)?.locals?.db as Database | undefined;
      if (!db) return res.status(500).json({ error: 'db unavailable' });

      const groupId = String(req.params.groupId || '').trim();
      if (!groupId) return res.status(400).json({ error: 'groupId required' });

      // Find all transactions that belong to this group
      // First, try by reimbursementGroupId
      const byGroupId = db.prepare(`
        SELECT id FROM transactions
        WHERE reimbursementGroupId = ?
      `).all(groupId) as Array<{ id: number }>;

      // Also try by fallback grouping (normalized counterpart name)
      let byFallback: Array<{ id: number }> = [];
      if (groupId.startsWith('rb_fallback:')) {
        const normalizedName = groupId.replace('rb_fallback:', '');
        // We need to match by normalized counterpart name
        // Since we can't easily normalize in SQL, we'll get all transactions and filter in JS
        const allTxs = db.prepare(`
          SELECT id, counterpartName, payee
          FROM transactions
          WHERE (isReimbursement = 1 OR amountCents < 0)
            AND (reimbursementGroupId IS NULL OR reimbursementGroupId = '')
        `).all() as Array<{ id: number; counterpartName: string | null; payee: string | null }>;

        for (const tx of allTxs) {
          const txNormalized = normalizeMerchantNameForFuzzy(tx.counterpartName ?? tx.payee ?? '');
          if (txNormalized === normalizedName) {
            byFallback.push({ id: tx.id });
          }
        }
      }

      // Combine all transaction IDs
      const allTxIds = [...byGroupId.map(t => t.id), ...byFallback.map(t => t.id)];

      if (allTxIds.length === 0) {
        return res.status(404).json({ error: 'No transactions found for this group' });
      }

      // Update all transactions to set ignoreForReimbursement = 1
      const placeholders = allTxIds.map(() => '?').join(',');
      const updated = db.prepare(`
        UPDATE transactions
        SET ignoreForReimbursement = 1
        WHERE id IN (${placeholders})
      `).run(...allTxIds);

      return res.json({ success: true, updatedCount: updated.changes || allTxIds.length });
    } catch (e: any) {
      console.error('[review] ignore reimbursement group failed', e);
      return res.status(500).json({ error: 'Failed to ignore reimbursement group' });
    }
  });

  // POST /api/review/reimbursements/:groupId/allocate
  router.post('/api/review/reimbursements/:groupId/allocate', (req: Request, res: Response) => {
    try {
      const db = (req.app as any)?.locals?.db as Database | undefined;
      if (!db) return res.status(500).json({ error: 'db unavailable' });

      const groupId = String(req.params.groupId || '').trim();
      if (!groupId) return res.status(400).json({ error: 'groupId required' });

      const body = req.body as {
        inflowTransactionId: string;
        allocations: Array<{
          expenseTransactionId: string;
          allocatedAmountCents: number;
        }>;
      };

      // Validate request body
      if (!body.inflowTransactionId || typeof body.inflowTransactionId !== 'string') {
        return res.status(400).json({ error: 'inflowTransactionId required' });
      }

      if (!Array.isArray(body.allocations) || body.allocations.length === 0) {
        return res.status(400).json({ error: 'allocations must be a non-empty array' });
      }

      // Validate allocations
      for (const alloc of body.allocations) {
        if (!alloc.expenseTransactionId || typeof alloc.expenseTransactionId !== 'string') {
          return res.status(400).json({ error: 'expenseTransactionId required for all allocations' });
        }
        if (typeof alloc.allocatedAmountCents !== 'number' || alloc.allocatedAmountCents <= 0) {
          return res.status(400).json({ error: 'allocatedAmountCents must be a positive number' });
        }
      }

      // Optional: Validate that allocated amount doesn't exceed inflow amount
      const inflowTx = db.prepare(`
        SELECT amountCents FROM transactions WHERE id = ?
      `).get(Number(body.inflowTransactionId)) as { amountCents: number } | undefined;

      if (inflowTx) {
        const totalAllocated = body.allocations.reduce((sum, a) => sum + a.allocatedAmountCents, 0);
        const inflowAmount = Math.abs(inflowTx.amountCents);
        if (totalAllocated > inflowAmount) {
          return res.status(400).json({ error: 'Allocated amount exceeds reimbursement amount' });
        }
      }

      // Delete existing allocations for this inflow
      db.prepare(`
        DELETE FROM reimbursement_allocations
        WHERE groupId = ? AND inflowTransactionId = ?
      `).run(groupId, String(body.inflowTransactionId));

      // Insert new allocations
      const insertStmt = db.prepare(`
        INSERT INTO reimbursement_allocations (groupId, inflowTransactionId, expenseTransactionId, allocatedAmountCents)
        VALUES (?, ?, ?, ?)
      `);

      for (const alloc of body.allocations) {
        insertStmt.run(groupId, String(body.inflowTransactionId), String(alloc.expenseTransactionId), alloc.allocatedAmountCents);
      }

      return res.json({ success: true });
    } catch (e: any) {
      console.error('[review] save reimbursement allocation failed', e);
      return res.status(500).json({ error: 'Failed to save reimbursement allocation' });
    }
  });
}

/**
 * SONSTIGES WIZARD - CASH WITHDRAWAL EXCLUSION SUMMARY
 * ===================================================
 * 
 * The Sonstiges wizard (Sonstiges Cleanup Wizard) excludes cash withdrawals
 * from all queries to ensure ATM / cash machine transactions do not appear
 * in the "Sonstiges" cleanup flow.
 * 
 * Cash withdrawal detection:
 * - Uses isCashWithdrawalLike() from cashMatcher.ts to detect ATM patterns
 * - Flags are set during import normalization (normalizeCanonicalRow in db.ts)
 * - Cash withdrawals are categorized as cash:withdrawal by the engine (engine.ts)
 * 
 * Exclusion points:
 * 1. /api/review/sonstiges-summary - SQL WHERE clause excludes isCashWithdrawal = 1
 * 2. /api/review/sonstiges/apply - SQL WHERE clause excludes isCashWithdrawal = 1
 * 3. /api/review/sonstiges/group/:groupId/transactions - SQL WHERE clause excludes isCashWithdrawal = 1
 * 4. buildSonstigesSuggestionForGroup() - SQL WHERE clause excludes isCashWithdrawal = 1
 * 
 * Supported cash withdrawal patterns (via cashMatcher.ts):
 * - "AUSZAHLUNG GAA" (comdirect)
 * - "BARGELDAUSZAHLUNG" (German "cash withdrawal")
 * - "GAA" + "BARGELD" together (comdirect pattern)
 * - "GELDAUTOMAT" (German "cash machine" / ATM)
 * - "ATM" with withdrawal keywords or bank names
 * - comdirect-specific: "GAA" + "AUFTRAGGEBER" + bank context
 * 
 * Real-world example that is excluded:
 * "Auszahlung GAA | Auftraggeber: DEUTSCHE BANK Buchungstext: Bargeldauszahlung Deutsche Bank//Köln/DE ..."
 * 
 * Cash withdrawals:
 * - Are automatically detected during import
 * - Are categorized as cash:withdrawal (not Sonstiges)
 * - Are excluded from Sonstiges wizard queries
 * - Are excluded from spending summaries (summary.ts)
 * - Are shown with category "Bargeldabhebung" in the UI
 */

