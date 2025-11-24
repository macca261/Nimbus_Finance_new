import { Router } from 'express';
import { startOfMonth, endOfMonth, firstDayMonthsAgo, lastDayMonthsAgo, getMonthRange } from '../lib/dates';
import { isValidCategory } from '../config/categories';
import type { CategoryId } from '../config/categories';

const summary = Router();

function getLatestYm(req: any): string | null {
  const db = (req.app as any).locals.db;
  const row = db.prepare(`SELECT strftime('%Y-%m', MAX(bookingDate)) AS ym FROM transactions`).get() as { ym?: string };
  return row?.ym ?? null;
}

// Helper to build refund exclusion clause
function getRefundExclusionClause(includeRefunds: boolean): string {
  if (includeRefunds) return '';
  return 'AND (isRefund = 0 OR isRefund IS NULL) AND (isRefunded = 0 OR isRefunded IS NULL)';
}

// Helper to build internal transfer exclusion clause
function getInternalTransferExclusionClause(includeInternalTransfers?: boolean): string {
  if (includeInternalTransfers) return '';
  return 'AND (isInternalTransfer = 0 OR isInternalTransfer IS NULL)';
}

// Helper to build pass-through exclusion clause
function getPassThroughExclusionClause(includePassThrough?: boolean): string {
  if (includePassThrough) return '';
  return 'AND (isPassThrough = 0 OR isPassThrough IS NULL)';
}

// Helper to build cash withdrawal exclusion clause
function getCashWithdrawalExclusionClause(includeCashWithdrawals?: boolean): string {
  if (includeCashWithdrawals) return '';
  return 'AND (isCashWithdrawal = 0 OR isCashWithdrawal IS NULL)';
}

// Helper to build reimbursement exclusion clause
function getReimbursementExclusionClause(includeReimbursements?: boolean): string {
  if (includeReimbursements) return '';
  return 'AND (isReimbursement = 0 OR isReimbursement IS NULL)';
}
// GET /api/summary/balance -> { data: { balanceCents, currency } }
summary.get('/balance', (req, res) => {
  try {
    const db = (req.app as any).locals.db;
    const includeRefunds = (req.query as any)?.includeRefunds === 'true';
    const includeInternalTransfers = (req.query as any)?.includeInternalTransfers === 'true';
    const includePassThrough = (req.query as any)?.includePassThrough === 'true';
    const includeCashWithdrawals = (req.query as any)?.includeCashWithdrawals === 'true';
    const refundClause = getRefundExclusionClause(includeRefunds);
    const internalTransferClause = getInternalTransferExclusionClause(includeInternalTransfers);
    const passThroughClause = getPassThroughExclusionClause(includePassThrough);
    const cashWithdrawalClause = getCashWithdrawalExclusionClause(includeCashWithdrawals);
    const reimbursementClause = getReimbursementExclusionClause();
    const totalRow = db.prepare(`SELECT COALESCE(SUM(amountCents),0) AS sum FROM transactions WHERE 1=1 ${refundClause} ${internalTransferClause} ${passThroughClause} ${cashWithdrawalClause} ${reimbursementClause}`).get() as { sum?: number };
    const payload: { balanceCents: number; currency: string; month?: string; monthNetCents?: number } = {
      balanceCents: totalRow?.sum ?? 0,
      currency: 'EUR',
    };
    const qMonth = (req.query as any)?.month as string | undefined;
    if (qMonth) {
      const { start, end, month } = getMonthRange(qMonth);
      const monthRow = db.prepare(`SELECT COALESCE(SUM(amountCents),0) AS sum FROM transactions WHERE bookingDate BETWEEN ? AND ? ${refundClause} ${internalTransferClause} ${cashWithdrawalClause}`).get(start, end) as { sum?: number };
      payload.month = month;
      payload.monthNetCents = monthRow?.sum ?? 0;
    }
    res.json({ data: payload });
  } catch (e) {
    res.json({ data: { balanceCents: 0, currency: 'EUR' } });
  }
});

// GET /api/summary/month (income/expense for current month)
summary.get('/month', (req, res) => {
  try {
    const rawMonth = (req.query as any).month as string | undefined;
    const fallback = rawMonth || getLatestYm(req);
    if (!fallback) return res.json({ month: null, incomeCents: 0, expenseCents: 0 });
    const { start, end, month } = getMonthRange(fallback);
    const db = (req.app as any).locals.db;
    const includeRefunds = (req.query as any)?.includeRefunds === 'true';
    const includeInternalTransfers = (req.query as any)?.includeInternalTransfers === 'true';
    const includePassThrough = (req.query as any)?.includePassThrough === 'true';
    const includeCashWithdrawals = (req.query as any)?.includeCashWithdrawals === 'true';
    const refundClause = getRefundExclusionClause(includeRefunds);
    const internalTransferClause = getInternalTransferExclusionClause(includeInternalTransfers);
    const passThroughClause = getPassThroughExclusionClause(includePassThrough);
    const cashWithdrawalClause = getCashWithdrawalExclusionClause(includeCashWithdrawals);
    const reimbursementClause = getReimbursementExclusionClause();
    const inc = db.prepare(`
      SELECT COALESCE(SUM(amountCents),0) AS sum
      FROM transactions
      WHERE amountCents > 0 AND bookingDate BETWEEN ? AND ? ${refundClause} ${internalTransferClause} ${passThroughClause} ${cashWithdrawalClause} ${reimbursementClause}
    `).get(start, end) as { sum?: number };
    const exp = db.prepare(`
      SELECT COALESCE(SUM(amountCents),0) AS sum
      FROM transactions
      WHERE amountCents < 0 AND bookingDate BETWEEN ? AND ? ${refundClause} ${internalTransferClause} ${passThroughClause} ${cashWithdrawalClause} ${reimbursementClause}
    `).get(start, end) as { sum?: number };
    
    // Calculate reimbursement offsets for this month
    const reimbursementTotal = db.prepare(`
      SELECT COALESCE(SUM(i.amountCents), 0) AS sum
      FROM transactions e
      INNER JOIN transactions i ON e.reimbursementGroupId = i.reimbursementGroupId
        AND e.reimbursementRole = 'payer'
        AND i.reimbursementRole = 'receiver'
      WHERE e.bookingDate BETWEEN ? AND ?
        AND e.isReimbursement = 1
        AND i.isReimbursement = 1
        ${refundClause.replace('AND', 'AND e.')}
        ${internalTransferClause.replace('AND', 'AND e.')}
    `).get(start, end) as { sum?: number };
    
    const rawExpenseCents = Math.abs(exp?.sum ?? 0);
    const reimbursementsInCents = Math.trunc(reimbursementTotal?.sum ?? 0);
    const netExpenseCents = Math.max(0, rawExpenseCents - reimbursementsInCents);
    
    res.json({
      month,
      incomeCents: inc?.sum ?? 0,
      expenseCents: rawExpenseCents,
      rawExpenseCents,
      netExpenseCents,
      reimbursementsInCents,
    });
  } catch {
    res.json({ month: null, incomeCents: 0, expenseCents: 0 });
  }
});

// GET /api/summary/categories -> { data: [{ category, amountCents }] }
summary.get('/categories', (req, res) => {
  try {
    const db = (req.app as any).locals.db;
    const monthParam = (req.query as any)?.month as string | undefined;
    const includeRefunds = (req.query as any)?.includeRefunds === 'true';
    const includeInternalTransfers = (req.query as any)?.includeInternalTransfers === 'true';
    const includePassThrough = (req.query as any)?.includePassThrough === 'true';
    const includeCashWithdrawals = (req.query as any)?.includeCashWithdrawals === 'true';
    const refundClause = getRefundExclusionClause(includeRefunds);
    const internalTransferClause = getInternalTransferExclusionClause(includeInternalTransfers);
    const passThroughClause = getPassThroughExclusionClause(includePassThrough);
    const cashWithdrawalClause = getCashWithdrawalExclusionClause(includeCashWithdrawals);
    const reimbursementClause = getReimbursementExclusionClause();
    const hasMonth = Boolean(monthParam);
    const params: unknown[] = [];
    let whereClause = '';
    if (hasMonth) {
      const { start, end } = getMonthRange(monthParam);
      whereClause = `WHERE bookingDate BETWEEN ? AND ? ${refundClause} ${internalTransferClause} ${passThroughClause} ${cashWithdrawalClause} ${reimbursementClause}`;
      params.push(start, end);
    } else {
      whereClause = `WHERE 1=1 ${refundClause} ${internalTransferClause} ${passThroughClause} ${cashWithdrawalClause} ${reimbursementClause}`;
    }
    const sql = `
      SELECT
        COALESCE(NULLIF(TRIM(category), ''), 'other_review') AS category,
        SUM(CASE WHEN amountCents < 0 THEN amountCents ELSE 0 END) AS spendCents,
        SUM(CASE WHEN amountCents > 0 THEN amountCents ELSE 0 END) AS incomeCents
      FROM transactions
      ${whereClause}
      GROUP BY category
      ORDER BY ABS(SUM(CASE WHEN amountCents < 0 THEN amountCents ELSE 0 END)) DESC
      LIMIT 50
    `;
    const rows = db.prepare(sql).all(...params) as { category: string; spendCents: number | null; incomeCents: number | null }[];
    
    // Calculate reimbursement offsets per category
    let reimbursementWhere = '';
    if (hasMonth) {
      reimbursementWhere = `WHERE e.bookingDate BETWEEN ? AND ?`;
    } else {
      reimbursementWhere = `WHERE 1=1`;
    }
    const reimbursementSql = `
      SELECT
        e.category AS category,
        SUM(i.amountCents) AS reimbursementCents
      FROM transactions e
      INNER JOIN transactions i ON e.reimbursementGroupId = i.reimbursementGroupId
        AND e.reimbursementRole = 'payer'
        AND i.reimbursementRole = 'receiver'
      ${reimbursementWhere}
        AND e.isReimbursement = 1
        AND i.isReimbursement = 1
      GROUP BY e.category
    `;
    const reimbursementRows = db.prepare(reimbursementSql).all(...(hasMonth ? params : [])) as Array<{ category: string; reimbursementCents: number | null }>;
    const reimbursementMap = new Map<string, number>();
    for (const row of reimbursementRows) {
      const category = (row.category ?? '').trim();
      reimbursementMap.set(category, Math.trunc(row.reimbursementCents ?? 0));
    }
    
    const data = (rows ?? []).map(r => {
      const rawId = (r.category ?? '').trim();
      const categoryId: CategoryId = isValidCategory(rawId) ? rawId : 'other_review';
      const spend = Math.abs(r.spendCents ?? 0);
      const income = Math.trunc(r.incomeCents ?? 0);
      const rawExpenseCents = categoryId.startsWith('income_') ? income : Math.trunc(spend);
      const reimbursementsInCents = reimbursementMap.get(rawId) ?? 0;
      const netExpenseCents = Math.max(0, rawExpenseCents - reimbursementsInCents);
      
      return {
        category: categoryId,
        rawExpenseCents,
        netExpenseCents,
        reimbursementsInCents,
      };
    });
    res.json({ data });
  } catch {
    res.json({ data: [] });
  }
});

// GET /api/summary/monthly-6 (last 6 months income/expense)
summary.get('/monthly-6', (req, res) => {
  try {
    const latest = getLatestYm(req);
    if (!latest) return res.json({ baseMonth: null, series: [] });
    const db = (req.app as any).locals.db;
    const rows = db.prepare(`
      WITH RECURSIVE months(ym, n) AS (
        SELECT ?, 0
        UNION ALL
        SELECT strftime('%Y-%m', date(ym||'-01', '-1 month')), n+1 FROM months WHERE n < 5
      )
      SELECT m.ym,
             COALESCE((
               SELECT SUM(amountCents) FROM transactions
               WHERE amountCents > 0 AND strftime('%Y-%m', bookingDate) = m.ym
                 AND (isRefund = 0 OR isRefund IS NULL) AND (isRefunded = 0 OR isRefunded IS NULL)
                 AND (isInternalTransfer = 0 OR isInternalTransfer IS NULL)
                 AND (isPassThrough = 0 OR isPassThrough IS NULL)
                 AND (isCashWithdrawal = 0 OR isCashWithdrawal IS NULL)
                 AND (isReimbursement = 0 OR isReimbursement IS NULL)
             ),0) AS inc,
             ABS(COALESCE((
               SELECT SUM(amountCents) FROM transactions
               WHERE amountCents < 0 AND strftime('%Y-%m', bookingDate) = m.ym
                 AND (isRefund = 0 OR isRefund IS NULL) AND (isRefunded = 0 OR isRefunded IS NULL)
                 AND (isInternalTransfer = 0 OR isInternalTransfer IS NULL)
                 AND (isPassThrough = 0 OR isPassThrough IS NULL)
                 AND (isCashWithdrawal = 0 OR isCashWithdrawal IS NULL)
                 AND (isReimbursement = 0 OR isReimbursement IS NULL)
             ),0)) AS exp
      FROM months m
      ORDER BY m.ym
    `).all(latest) as { ym: string; inc: number; exp: number }[];
    const series = (rows ?? []).map(r => ({ label: r.ym, incomeCents: Math.trunc(r.inc ?? 0), expenseCents: Math.trunc(r.exp ?? 0) }));
    res.json({ baseMonth: latest, series });
  } catch {
    res.json({ baseMonth: null, series: [] });
  }
});

// GET /api/summary/monthly?months=6 -> { data: [{ month, incomeCents, expenseCents }] }
summary.get('/monthly', (req, res) => {
  try {
    const months = Math.max(1, Math.min(24, Number((req.query as any).months) || 6));
    const latest = getLatestYm(req);
    if (!latest) return res.json({ data: [] });
    const db = (req.app as any).locals.db;
    const rows = db.prepare(`
      WITH RECURSIVE months(ym, n) AS (
        SELECT ?, 0
        UNION ALL
        SELECT strftime('%Y-%m', date(ym||'-01', '-1 month')), n+1 FROM months WHERE n < ?-1
      )
      SELECT m.ym,
             COALESCE((
               SELECT SUM(amountCents) FROM transactions
               WHERE amountCents > 0 AND strftime('%Y-%m', bookingDate) = m.ym
                 AND (isRefund = 0 OR isRefund IS NULL) AND (isRefunded = 0 OR isRefunded IS NULL)
                 AND (isInternalTransfer = 0 OR isInternalTransfer IS NULL)
                 AND (isCashWithdrawal = 0 OR isCashWithdrawal IS NULL)
                 AND (isReimbursement = 0 OR isReimbursement IS NULL)
             ),0) AS inc,
             ABS(COALESCE((
               SELECT SUM(amountCents) FROM transactions
               WHERE amountCents < 0 AND strftime('%Y-%m', bookingDate) = m.ym
                 AND (isRefund = 0 OR isRefund IS NULL) AND (isRefunded = 0 OR isRefunded IS NULL)
                 AND (isInternalTransfer = 0 OR isInternalTransfer IS NULL)
                 AND (isCashWithdrawal = 0 OR isCashWithdrawal IS NULL)
                 AND (isReimbursement = 0 OR isReimbursement IS NULL)
             ),0)) AS exp
      FROM months m
      ORDER BY m.ym
    `).all(latest, months) as { ym: string; inc: number; exp: number }[];
    const data = (rows ?? []).map(r => ({ month: r.ym, incomeCents: Math.trunc(r.inc ?? 0), expenseCents: Math.trunc(r.exp ?? 0) }));
    res.json({ data });
  } catch {
    res.json({ data: [] });
  }
});

// GET /api/summary/monthly-6-income-expense -> Last 6 months income/expense
summary.get('/monthly-6-income-expense', (req, res) => {
  try {
    const db = (req.app as any).locals.db;
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth(); // 0-indexed
    
    // Build list of last 6 months (including current month)
    const months: Array<{ year: number; month: number; label: string }> = [];
    for (let i = 0; i < 6; i++) {
      const date = new Date(Date.UTC(currentYear, currentMonth - i, 1));
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth() + 1; // 1-indexed
      const label = `${year}-${String(month).padStart(2, '0')}`;
      months.push({ year, month, label });
    }
    
    // Reverse to get ascending order (oldest first)
    months.reverse();
    
    // Use exclusion helpers (default: exclude all)
    const refundClause = getRefundExclusionClause(false);
    const internalTransferClause = getInternalTransferExclusionClause(false);
    const passThroughClause = getPassThroughExclusionClause(false);
    const cashWithdrawalClause = getCashWithdrawalExclusionClause(false);
    const reimbursementClause = getReimbursementExclusionClause();
    
    const results = months.map(({ label }) => {
      // Get start and end dates for this month using getMonthRange for consistency
      const { start, end } = getMonthRange(label);
      
      // Calculate income (positive amounts)
      const incomeRow = db.prepare(`
        SELECT COALESCE(SUM(amountCents), 0) AS sum
        FROM transactions
        WHERE amountCents > 0 
          AND bookingDate BETWEEN ? AND ?
          ${refundClause}
          ${internalTransferClause}
          ${passThroughClause}
          ${cashWithdrawalClause}
          ${reimbursementClause}
      `).get(start, end) as { sum?: number };
      
      // Calculate expenses (negative amounts, absolute value)
      const expenseRow = db.prepare(`
        SELECT COALESCE(SUM(amountCents), 0) AS sum
        FROM transactions
        WHERE amountCents < 0 
          AND bookingDate BETWEEN ? AND ?
          ${refundClause}
          ${internalTransferClause}
          ${passThroughClause}
          ${cashWithdrawalClause}
          ${reimbursementClause}
      `).get(start, end) as { sum?: number };
      
      const totalIncomeCents = Math.trunc(incomeRow?.sum ?? 0);
      const totalExpenseCents = Math.abs(Math.trunc(expenseRow?.sum ?? 0));
      
      return {
        month: label,
        totalIncomeCents,
        totalExpenseCents,
      };
    });
    
    res.json({ data: results });
  } catch (e) {
    res.json({ data: [] });
  }
});

// GET /api/summary/internal-transfers -> Internal transfers summary
summary.get('/internal-transfers', (req, res) => {
  try {
    const db = (req.app as any).locals.db;
    const monthParam = (req.query as any)?.month as string | undefined;
    const latest = monthParam || getLatestYm(req);
    
    if (!latest) {
      return res.json({
        period: { from: null, to: null },
        totals: {
          savingsOutCents: 0,
          savingsInCents: 0,
          walletOutCents: 0,
          walletInCents: 0,
          otherOutCents: 0,
          otherInCents: 0,
        },
      });
    }
    
    const { start, end } = getMonthRange(latest);
    
    // Query internal transfers grouped by kind and direction
    const rows = db.prepare(`
      SELECT
        internalTransferKind AS kind,
        internalTransferDirection AS direction,
        SUM(ABS(amountCents)) AS totalCents
      FROM transactions
      WHERE isInternalTransfer = 1
        AND bookingDate BETWEEN ? AND ?
      GROUP BY internalTransferKind, internalTransferDirection
    `).all(start, end) as Array<{ kind: string | null; direction: string | null; totalCents: number | null }>;
    
    const totals = {
      savingsOutCents: 0,
      savingsInCents: 0,
      walletOutCents: 0,
      walletInCents: 0,
      otherOutCents: 0,
      otherInCents: 0,
    };
    
    for (const row of rows) {
      const kind = row.kind || 'other';
      const direction = row.direction || 'out';
      const cents = Math.trunc(row.totalCents ?? 0);
      
      if (kind === 'savings') {
        if (direction === 'out') totals.savingsOutCents += cents;
        else totals.savingsInCents += cents;
      } else if (kind === 'wallet') {
        if (direction === 'out') totals.walletOutCents += cents;
        else totals.walletInCents += cents;
      } else {
        if (direction === 'out') totals.otherOutCents += cents;
        else totals.otherInCents += cents;
      }
    }
    
    res.json({
      period: { from: start, to: end },
      totals,
    });
  } catch (e) {
    res.json({
      period: { from: null, to: null },
      totals: {
        savingsOutCents: 0,
        savingsInCents: 0,
        walletOutCents: 0,
        walletInCents: 0,
        otherOutCents: 0,
        otherInCents: 0,
      },
    });
  }
});

// GET /api/summary/month -> { summary: MonthSummary }
summary.get('/month', async (req, res) => {
  try {
    const db = (req.app as any).locals.db;
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const monthParam = (req.query as any).month as string | undefined;
    const { getMonthSummary } = await import('../services/monthSummaryService');
    const summary = await getMonthSummary(db, monthParam);

    res.json({ summary });
  } catch (error: any) {
    console.error('[summary/month] Error:', error?.message || error);
    res.status(500).json({ error: 'Failed to get month summary' });
  }
});

// GET /api/summary/month-narrative -> { summary: MonthSummary, narrative: MonthNarrative }
summary.get('/month-narrative', async (req, res) => {
  try {
    const db = (req.app as any).locals.db;
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const monthParam = (req.query as any).month as string | undefined;
    const { getMonthSummary } = await import('../services/monthSummaryService');
    const { getMonthNarrative } = await import('../services/aiSummaryService');

    // Get numeric summary
    const summary = await getMonthSummary(db, monthParam);

    // Get AI narrative (falls back to template if AI is disabled)
    const narrative = await getMonthNarrative(summary, { locale: 'de' });

    res.json({ summary, narrative });
  } catch (error: any) {
    console.error('[summary/month-narrative] Error:', error?.message || error);
    res.status(500).json({ error: 'Failed to get month narrative' });
  }
});

export default summary;


