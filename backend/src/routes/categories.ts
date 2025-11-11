import { Router } from 'express';
import { db } from '../db';
import { CATEGORIES, getCategoryDefinition, isValidCategory } from '../config/categories';
import type { CategoryId } from '../config/categories';

const router = Router();

router.get('/', (_req, res) => {
  const categories = CATEGORIES.map(category => ({
    id: category.id,
    label: category.label,
    group: category.group,
    priority: category.priority,
  }));
  res.json({ categories });
});

router.get('/breakdown', (req, res) => {
  const { from = '1970-01-01', to = '2999-12-31' } = req.query as Record<string, string>;
  try {
    const rows = db
      .prepare(
        `
        SELECT category AS id, SUM(amountCents) AS totalCents
        FROM transactions
        WHERE bookingDate BETWEEN ? AND ?
        GROUP BY category
      `,
      )
      .all(String(from), String(to)) as Array<{ id: string | null; totalCents: number | null }>;

    const breakdown = rows
      .map(row => {
        const rawId = (row.id ?? 'other_review').trim() || 'other_review';
        const categoryId: CategoryId = isValidCategory(rawId) ? rawId : 'other_review';
        const def = getCategoryDefinition(categoryId);
        const amount = typeof row.totalCents === 'number' ? row.totalCents / 100 : 0;
        return {
          id: def.id,
          label: def.label,
          group: def.group,
          amount,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    res.json({ from, to, breakdown });
  } catch (error) {
    console.error('[categories] breakdown failed', error);
    res.status(500).json({ error: 'Failed to load breakdown' });
  }
});

export default router;

