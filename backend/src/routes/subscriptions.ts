import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Database } from '../db';
import { detectSubscriptionCandidates } from '../categorization/subscriptions';

export function mountSubscriptionRoutes(router: Router) {
  // GET /api/subscriptions/candidates?days=365
  router.get('/api/subscriptions/candidates', async (req: Request, res: Response) => {
    try {
      const db = (req.app as any).locals?.db as Database | undefined;
      if (!db) {
        return res.status(500).json({
          error: 'Database connection not available.',
        });
      }

      const daysParam = Number.parseInt(String((req.query as any)?.days ?? '365'), 10);
      const days = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 365;

      // Compute date cutoff
      const cutoffRow = db.prepare(`SELECT date('now', ?) AS d`).get(`-${days} days`) as { d: string };
      const cutoff = cutoffRow?.d;

      // Load transactions from the last N days
      // Exclude internal transfers, refunds, reimbursements, pass-through
      const rows = db.prepare(`
        SELECT id, bookingDate, amountCents, payee, counterpartName, purpose, memo
        FROM transactions
        WHERE bookingDate >= ?
          AND (isRefund = 0 OR isRefund IS NULL)
          AND (isRefunded = 0 OR isRefunded IS NULL)
          AND (isInternalTransfer = 0 OR isInternalTransfer IS NULL)
          AND (isReimbursement = 0 OR isReimbursement IS NULL)
          AND (isPassThrough = 0 OR isPassThrough IS NULL)
        ORDER BY bookingDate DESC
      `).all(cutoff) as Array<{
        id: number;
        bookingDate: string;
        amountCents: number;
        payee?: string | null;
        counterpartName?: string | null;
        purpose?: string | null;
        memo?: string | null;
      }>;

      // Convert to detection input format
      const transactions = rows.map(r => ({
        id: r.id,
        bookingDate: r.bookingDate,
        amountCents: r.amountCents,
        payee: r.payee,
        counterpartName: r.counterpartName,
        purpose: r.purpose,
        memo: r.memo,
      }));

      // Run detection
      const candidates = detectSubscriptionCandidates(transactions);

      // Filter to only expenses (negative amounts) - already handled in detection but double-check
      // And filter to only non-unknown frequency (already handled but double-check)
      const filteredCandidates = candidates.filter(c => c.frequency !== 'unknown');

      return res.json({
        candidates: filteredCandidates,
      });
    } catch (e: any) {
      console.error('[subscriptions] candidates endpoint failed', e);
      return res.status(500).json({
        error: 'Failed to detect subscription candidates.',
      });
    }
  });
}

