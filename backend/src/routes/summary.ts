import { Router } from 'express';
import { db } from '../db';
import { startOfMonth, endOfMonth, firstDayMonthsAgo, lastDayMonthsAgo } from '../lib/dates';

const summary = Router();

function getLatestYm(): string | null {
  const row = db.prepare(`SELECT strftime('%Y-%m', MAX(bookingDate)) AS ym FROM transactions`).get() as { ym?: string };
  return row?.ym ?? null;
}

// GET /api/summary/balance -> { data: { balanceCents, currency } }
summary.get('/balance', (_req, res) => {
  try {
    const row = db.prepare(`SELECT COALESCE(SUM(amountCents),0) AS sum FROM transactions`).get() as { sum?: number };
    res.json({ data: { balanceCents: row?.sum ?? 0, currency: 'EUR' } });
  } catch (e) {
    res.json({ data: { balanceCents: 0, currency: 'EUR' } });
  }
});

// GET /api/summary/month (income/expense for current month)
summary.get('/month', (req, res) => {
  try {
    const qMonth = (req.query as any).month as string | undefined || getLatestYm();
    if (!qMonth) return res.json({ month: null, incomeCents: 0, expenseCents: 0 });
    const inc = db.prepare(`
      SELECT COALESCE(SUM(amountCents),0) AS sum
      FROM transactions
      WHERE amountCents > 0 AND strftime('%Y-%m', bookingDate) = ?
    `).get(qMonth) as { sum?: number };
    const exp = db.prepare(`
      SELECT COALESCE(SUM(amountCents),0) AS sum
      FROM transactions
      WHERE amountCents < 0 AND strftime('%Y-%m', bookingDate) = ?
    `).get(qMonth) as { sum?: number };
    res.json({ month: qMonth, incomeCents: inc?.sum ?? 0, expenseCents: Math.abs(exp?.sum ?? 0) });
  } catch {
    res.json({ month: null, incomeCents: 0, expenseCents: 0 });
  }
});

// GET /api/summary/categories -> { data: [{ category, amountCents }] }
summary.get('/categories', (_req, res) => {
  try {
    const rows = db.prepare(`
      SELECT 
        COALESCE(
          NULLIF(TRIM(category), ''),
          CASE 
            WHEN UPPER(purpose) LIKE '%REWE%' OR UPPER(purpose) LIKE '%ALDI%' OR UPPER(purpose) LIKE '%LIDL%' OR UPPER(purpose) LIKE '%EDEKA%' THEN 'Groceries'
            WHEN UPPER(purpose) LIKE '%GEHALT%' OR UPPER(purpose) LIKE '%LOHN%' OR UPPER(purpose) LIKE '%SALARY%' THEN 'Income'
            WHEN UPPER(purpose) LIKE '%MIETE%' OR UPPER(purpose) LIKE '%RENT%' THEN 'Rent'
            WHEN UPPER(purpose) LIKE '%GEBÜHR%' OR UPPER(purpose) LIKE '%GEBU%HR%' OR UPPER(purpose) LIKE '%KARTENENTGELT%' THEN 'Fees'
            WHEN amountCents > 0 THEN 'Income'
            ELSE 'Other'
          END
        ) AS category,
        ABS(COALESCE(SUM(CASE WHEN amountCents < 0 THEN amountCents ELSE 0 END),0)) AS spend
      FROM transactions
      GROUP BY category
      ORDER BY spend DESC
      LIMIT 20
    `).all() as { category: string | null; spend: number }[];
    const data = (rows ?? []).map(r => ({ category: r.category ?? 'Other', amountCents: Math.trunc(r.spend ?? 0) }));
    res.json({ data });
  } catch {
    res.json({ data: [] });
  }
});

// GET /api/summary/monthly-6 (last 6 months income/expense)
summary.get('/monthly-6', (_req, res) => {
  try {
    const latest = getLatestYm();
    if (!latest) return res.json({ baseMonth: null, series: [] });
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
             ),0) AS inc,
             ABS(COALESCE((
               SELECT SUM(amountCents) FROM transactions
               WHERE amountCents < 0 AND strftime('%Y-%m', bookingDate) = m.ym
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
    const latest = getLatestYm();
    if (!latest) return res.json({ data: [] });
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
             ),0) AS inc,
             ABS(COALESCE((
               SELECT SUM(amountCents) FROM transactions
               WHERE amountCents < 0 AND strftime('%Y-%m', bookingDate) = m.ym
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

export default summary;


