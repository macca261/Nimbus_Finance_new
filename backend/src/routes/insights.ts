import { Router } from 'express';
import { prisma } from '../db/prisma';

const router = Router();

function monthRange(month: string): { gte: string; lt: string } {
  // month format: YYYY-MM
  const [y, m] = month.split('-').map((n) => parseInt(n, 10));
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return { gte: `${month}-01`, lt: `${next}-01` };
}

router.get('/insights/monthly-summary', async (req, res) => {
  try {
    const month = String(req.query.month || '').trim();
    if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });
    const range = monthRange(month);
    const txs = await prisma.transaction.findMany({ where: { bookingDate: { gte: range.gte, lt: range.lt } } });
    const byCategory = new Map<string, number>();
    let income = 0;
    let expenses = 0;
    for (const t of txs) {
      const amt = Number(t.amount);
      if (amt >= 0) income += amt; else expenses += Math.abs(amt);
      const cat = t.categoryId || 'Other';
      const prev = byCategory.get(cat) || 0;
      byCategory.set(cat, prev + (amt < 0 ? Math.abs(amt) : 0));
    }
    const categories = Array.from(byCategory.entries()).map(([category, total]) => ({ category, total }));

    // trend: last 6 months totals
    const trend: { month: string; income: number; expenses: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(parseInt(month.slice(0, 4), 10), parseInt(month.slice(5, 7), 10) - 1, 1));
      d.setUTCMonth(d.getUTCMonth() - i);
      const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const r = monthRange(ym);
      const rows = await prisma.transaction.findMany({ where: { bookingDate: { gte: r.gte, lt: r.lt } }, select: { amount: true } });
      let inc = 0, exp = 0;
      for (const row of rows) { const n = Number(row.amount); if (n >= 0) inc += n; else exp += Math.abs(n); }
      trend.push({ month: ym, income: inc, expenses: exp });
    }

    res.json({ month, income, expenses, net: income - expenses, categories, trend });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to compute summary' });
  }
});

router.get('/insights/recurring', async (_req, res) => {
  try {
    // last 9 months window
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 9, 1));
    const txs = await prisma.transaction.findMany({
      where: { bookingDate: { gte: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-01` } },
      select: { id: true, bookingDate: true, amount: true, purpose: true, counterpartName: true, categoryId: true }
    });

    type Key = string;
    const groups = new Map<Key, { key: Key; name: string; amounts: number[]; dates: string[]; category?: string | null }>();
    for (const t of txs) {
      const name = (t.counterpartName || t.purpose || '').toUpperCase().replace(/\s+/g, ' ').trim().slice(0, 64);
      if (!name) continue;
      const amt = Math.abs(Number(t.amount));
      const round = Math.round(amt * 100) / 100;
      const key = `${name}|${round.toFixed(2)}`;
      const g = groups.get(key) || { key, name, amounts: [], dates: [], category: t.categoryId };
      g.amounts.push(round);
      g.dates.push(t.bookingDate);
      groups.set(key, g);
    }

    const recurring: any[] = [];
    for (const g of groups.values()) {
      if (g.dates.length < 3) continue;
      const sorted = g.dates.sort();
      // approximate monthly cadence check
      let monthlyHits = 0;
      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1]);
        const curr = new Date(sorted[i]);
        const diffDays = (curr.getTime() - prev.getTime()) / 86400000;
        if (diffDays >= 27 && diffDays <= 33) monthlyHits++;
      }
      if (monthlyHits >= 2) {
        const avg = g.amounts.reduce((a, b) => a + b, 0) / g.amounts.length;
        const nextDue = new Date(sorted[sorted.length - 1]);
        nextDue.setUTCMonth(nextDue.getUTCMonth() + 1);
        recurring.push({
          merchant: g.name,
          amount: Math.round(avg * 100) / 100,
          cadence: 'monthly',
          category: g.category || 'Subscriptions',
          nextDue: nextDue.toISOString().slice(0, 10),
        });
      }
    }

    res.json({ items: recurring.slice(0, 100) });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to detect recurring' });
  }
});

router.get('/insights/spending-analysis', async (req, res) => {
  try {
    const days = Math.min(parseInt(String(req.query.days || '90'), 10), 365);
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - days);
    const since = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-${String(start.getUTCDate()).padStart(2, '0')}`;
    const txs = await prisma.transaction.findMany({ where: { bookingDate: { gte: since } } });
    const byCategory = new Map<string, number>();
    const byMerchant = new Map<string, number>();
    let totalSpend = 0;
    for (const t of txs) {
      const amt = Number(t.amount);
      if (amt < 0) {
        const spend = Math.abs(amt);
        totalSpend += spend;
        const cat = t.categoryId || 'Other';
        byCategory.set(cat, (byCategory.get(cat) || 0) + spend);
        const name = (t.counterpartName || t.purpose || 'Unknown').toUpperCase().slice(0, 64);
        byMerchant.set(name, (byMerchant.get(name) || 0) + spend);
      }
    }
    const categories = Array.from(byCategory.entries()).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
    const merchants = Array.from(byMerchant.entries()).map(([merchant, total]) => ({ merchant, total })).sort((a, b) => b.total - a.total).slice(0, 20);
    const healthScore = computeHealthScore({ totalSpend, categories });
    res.json({ totalSpend, categories, merchants, healthScore });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to analyze spending' });
  }
});

function computeHealthScore(input: { totalSpend: number; categories: { category: string; total: number }[] }): number {
  const essentials = ['Housing', 'Utilities', 'Groceries'];
  const essentialsSpend = input.categories.filter(c => essentials.includes(c.category)).reduce((a, b) => a + b.total, 0);
  const discretionary = input.totalSpend - essentialsSpend;
  // Simple heuristic: more spend on essentials relative to total yields a higher score; less discretionary is good
  const ratio = essentialsSpend / (input.totalSpend || 1);
  let score = Math.round((0.5 * ratio + 0.5 * (1 - discretionary / (input.totalSpend || 1))) * 100);
  score = Math.min(100, Math.max(0, score));
  return score;
}

export default router;


