import { Router } from 'express';
import { startOfMonth, endOfMonth, firstDayMonthsAgo, lastDayMonthsAgo, getMonthRange } from '../lib/dates';

const summary = Router();

function getLatestYm(req: any): string | null {
  const db = (req.app as any).locals.db;
  const row = db.prepare(`SELECT strftime('%Y-%m', MAX(bookingDate)) AS ym FROM transactions`).get() as { ym?: string };
  return row?.ym ?? null;
}

// GET /api/summary/balance -> { data: { balanceCents, currency } }
summary.get('/balance', (req, res) => {
  try {
    const db = (req.app as any).locals.db;
    const totalRow = db.prepare(`SELECT COALESCE(SUM(amountCents),0) AS sum FROM transactions`).get() as { sum?: number };
    const payload: { balanceCents: number; currency: string; month?: string; monthNetCents?: number } = {
      balanceCents: totalRow?.sum ?? 0,
      currency: 'EUR',
    };
    const qMonth = (req.query as any)?.month as string | undefined;
    if (qMonth) {
      const { start, end, month } = getMonthRange(qMonth);
      const monthRow = db.prepare(`SELECT COALESCE(SUM(amountCents),0) AS sum FROM transactions WHERE bookingDate BETWEEN ? AND ?`).get(start, end) as { sum?: number };
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
    const inc = db.prepare(`
      SELECT COALESCE(SUM(amountCents),0) AS sum
      FROM transactions
      WHERE amountCents > 0 AND bookingDate BETWEEN ? AND ?
    `).get(start, end) as { sum?: number };
    const exp = db.prepare(`
      SELECT COALESCE(SUM(amountCents),0) AS sum
      FROM transactions
      WHERE amountCents < 0 AND bookingDate BETWEEN ? AND ?
    `).get(start, end) as { sum?: number };
    res.json({ month, incomeCents: inc?.sum ?? 0, expenseCents: Math.abs(exp?.sum ?? 0) });
  } catch {
    res.json({ month: null, incomeCents: 0, expenseCents: 0 });
  }
});

// GET /api/summary/categories -> { data: [{ category, amountCents }] }
summary.get('/categories', (req, res) => {
  try {
    const db = (req.app as any).locals.db;
    const monthParam = (req.query as any)?.month as string | undefined;
    const hasMonth = Boolean(monthParam);
    const params: unknown[] = [];
    let whereClause = '';
    if (hasMonth) {
      const { start, end } = getMonthRange(monthParam);
      whereClause = 'WHERE bookingDate BETWEEN ? AND ?';
      params.push(start, end);
    }
    const sql = `
      SELECT
        COALESCE(NULLIF(TRIM(category), ''), 'Other') AS category,
        SUM(CASE WHEN amountCents < 0 THEN amountCents ELSE 0 END) AS spendCents,
        SUM(CASE WHEN amountCents > 0 THEN amountCents ELSE 0 END) AS incomeCents
      FROM transactions
      ${whereClause}
      GROUP BY category
      ORDER BY ABS(SUM(CASE WHEN amountCents < 0 THEN amountCents ELSE 0 END)) DESC
      LIMIT 50
    `;
    const rows = db.prepare(sql).all(...params) as { category: string; spendCents: number | null; incomeCents: number | null }[];
    const data = (rows ?? []).map(r => {
      const category = r.category || 'Other';
      const spend = Math.abs(r.spendCents ?? 0);
      const income = Math.trunc(r.incomeCents ?? 0);
      const amountCents = category === 'Income' ? income : Math.trunc(spend);
      return { category, amountCents };
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


