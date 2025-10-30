import { Router } from 'express';
import { prisma } from '../db/prisma';

const router = Router();

const BASE_CATEGORIES = [
  'Groceries','Dining','Utilities','Transportation','Subscriptions','Fees','Income','Housing','Savings','Entertainment','Other'
];

router.get('/', (_req, res) => {
  res.json({ items: BASE_CATEGORIES.map(id => ({ id, name: id })) });
});

router.get('/breakdown', async (req, res) => {
  const from = String(req.query.from || '1970-01-01');
  const to = String(req.query.to || '2999-12-31');
  const rows = await prisma.transaction.findMany({
    where: { bookingDate: { gte: from, lte: to } },
    select: { categoryId: true, amount: true }
  });
  const totals = new Map<string, number>();
  for (const r of rows) {
    const cat = r.categoryId || 'Other';
    const amt = Number(r.amount);
    if (amt < 0) totals.set(cat, (totals.get(cat) || 0) + Math.abs(amt));
  }
  const items = Array.from(totals.entries()).map(([categoryId, total]) => ({ categoryId, total }));
  res.json({ items });
});

export default router;


