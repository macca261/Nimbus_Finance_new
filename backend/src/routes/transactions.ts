import { Router } from 'express';
import { prisma } from '../db/prisma';
import { categorizeText, saveUserRule } from '../services/categorizer';

const router = Router();

router.get('/transactions', async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '100'), 10), 500);
    const offset = parseInt(String(req.query.offset || '0'), 10);
    const where: any = {};
    if (req.query.accountId) where.accountId = String(req.query.accountId);
    if (req.query.category) where.categoryId = String(req.query.category);
    if (req.query.from || req.query.to) where.bookingDate = {};
    if (req.query.from) where.bookingDate.gte = String(req.query.from);
    if (req.query.to) where.bookingDate.lte = String(req.query.to);
    if (req.query.q) where.OR = [
      { purpose: { contains: String(req.query.q), mode: 'insensitive' } },
      { counterpartName: { contains: String(req.query.q), mode: 'insensitive' } },
    ];
    const [items, total] = await Promise.all([
      prisma.transaction.findMany({ where, orderBy: { bookingDate: 'desc' }, skip: offset, take: limit }),
      prisma.transaction.count({ where }),
    ]);

    const data = items.map(it => {
      const explain = categorizeText([it.counterpartName, it.purpose].filter(Boolean).join(' '), Number(it.amount));
      return {
        id: it.id,
        bookingDate: it.bookingDate,
        valueDate: it.valueDate,
        amount: Number(it.amount),
        currency: it.currency,
        purpose: it.purpose,
        counterpartName: it.counterpartName,
        category: it.categoryId,
        confidence: it.categoryConfidence ?? explain.confidence,
        explain,
      };
    });
    res.json({ total, items });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to list transactions' });
  }
});

router.get('/review', async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '100'), 10), 500);
    const offset = parseInt(String(req.query.offset || '0'), 10);
    const maxConfidence = Math.min(parseFloat(String(req.query.maxConfidence || '0.7')), 0.99);
    const items = await prisma.transaction.findMany({
      where: { OR: [{ categoryId: null }, { categoryConfidence: null }, { categoryConfidence: { lt: maxConfidence } }] },
      orderBy: { bookingDate: 'desc' },
      skip: offset,
      take: limit,
    });
    const data = items.map(it => {
      const explain = categorizeText([it.counterpartName, it.purpose].filter(Boolean).join(' '), Number(it.amount));
      return {
        id: it.id,
        bookingDate: it.bookingDate,
        amount: Number(it.amount),
        purpose: it.purpose,
        counterpartName: it.counterpartName,
        category: it.categoryId,
        confidence: it.categoryConfidence ?? explain.confidence,
        explain,
      };
    });
    res.json({ items });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to load review queue' });
  }
});

router.patch('/transactions/:id/category', async (req, res) => {
  try {
    const id = String(req.params.id);
    const { category, pattern } = req.body as { category: string; pattern?: string };
    if (!category) return res.status(400).json({ error: 'Missing category' });
    const updated = await prisma.transaction.update({ where: { id }, data: { categoryId: category, categoryConfidence: 0.99 } });
    if (pattern && pattern.length >= 3) saveUserRule({ pattern, category: category as any });
    res.json({ ok: true, id: updated.id });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to update category' });
  }
});

export default router;


