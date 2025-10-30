import { Router } from 'express';
import { prisma } from '../db/prisma';

const router = Router();

router.get('/balance', async (_req, res) => {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const first = `${y}-${String(m + 1).padStart(2,'0')}-01`;
  const today = `${y}-${String(m + 1).padStart(2,'0')}-${String(now.getUTCDate()).padStart(2,'0')}`;

  const monthRows = await prisma.transaction.findMany({ where: { bookingDate: { gte: first, lte: today } }, select: { amount: true } });
  let monthSpend = 0; for (const r of monthRows) { const n = Number(r.amount); if (n < 0) monthSpend += Math.abs(n); }

  const prevDate = new Date(Date.UTC(y, m - 1, 1));
  const prevFirst = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2,'0')}-01`;
  const prevLast = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2,'0')}-28`;
  const prevRows = await prisma.transaction.findMany({ where: { bookingDate: { gte: prevFirst, lte: prevLast } }, select: { amount: true } });
  let lastMonthSpend = 0; for (const r of prevRows) { const n = Number(r.amount); if (n < 0) lastMonthSpend += Math.abs(n); }

  res.json({ currentBalance: null, monthToDateSpend: monthSpend, lastMonthSpend });
});

export default router;


