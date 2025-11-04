import { Router } from 'express';
import type { Database } from 'better-sqlite3';
import { getMonthRange, longestDailyStreak } from '../lib/dates';
import { sumCents, toEuros } from '../lib/money';

type AchievementId = 'no-fees' | 'saver-500' | 'groceries-under-200' | 'streak-7';

type Achievement = {
  id: AchievementId;
  title: string;
  description: string;
  achieved: boolean;
  progress: number;
  target?: number;
  current?: number;
};

const DEFINITIONS: Record<AchievementId, { title: string; description: string }> = {
  'no-fees': {
    title: 'Keine Gebühren',
    description: 'Kein einziger Gebühreneintrag im ausgewählten Monat.',
  },
  'saver-500': {
    title: 'Sparer · 500 €',
    description: 'Einnahmen minus Ausgaben liegt bei mindestens 500 €.',
  },
  'groceries-under-200': {
    title: 'Lebensmittel < 200 €',
    description: 'Lebensmittel-Ausgaben bleiben unter 200 €.',
  },
  'streak-7': {
    title: '7 Tage in Folge aktiv',
    description: 'Mindestens 7 aufeinanderfolgende Tage mit Buchungen.',
  },
};

const achievements = Router();

achievements.get('/', (req, res) => {
  try {
    const db: Database = (req.app as any).locals.db;
    const monthParam = (req.query as any)?.month as string | undefined;
    const { start, end, month } = getMonthRange(monthParam);

    const rows = db.prepare(`
      SELECT bookingDate, amountCents, category, purpose
      FROM transactions
      WHERE bookingDate BETWEEN ? AND ?
      ORDER BY bookingDate ASC
    `).all(start, end) as { bookingDate: string; amountCents: number | null; category: string | null; purpose: string | null }[];

    // integer cents only; count all negative amounts (no category filter)
    const incomeCents = rows.filter(r => (r.amountCents ?? 0) > 0).reduce((a, b) => a + (b.amountCents ?? 0), 0);
    const expenseCents = rows.filter(r => (r.amountCents ?? 0) < 0).reduce((a, b) => a + Math.abs(b.amountCents ?? 0), 0);
    const netCents = incomeCents - expenseCents;
    console.log('[achievements] debug rows', rows);
    console.log('[achievements] debug cents', { incomeCents, expenseCents, netCents });

    const feeCount = rows.filter(r => (r.category ?? '').toLowerCase() === 'fees').length;

    const grocerySpendCents = sumCents(
      rows
        .filter(r => (r.category ?? '').toLowerCase() === 'groceries' && (r.amountCents ?? 0) < 0)
        .map(r => -(r.amountCents ?? 0))
    );

    const streak = longestDailyStreak(rows.map(r => r.bookingDate), start, end);

    const clamp = (value: number) => Math.max(0, Math.min(100, value));

    const saverProgress = clamp(Math.round((netCents * 100) / 50000));
    const groceriesDelta = 20000 - grocerySpendCents;
    const groceriesProgress = clamp(Math.round((groceriesDelta * 100) / 20000));
    const streakProgress = clamp(Math.round((streak * 100) / 7));

    const achievementsList: Achievement[] = [
      {
        id: 'no-fees',
        title: DEFINITIONS['no-fees'].title,
        description: DEFINITIONS['no-fees'].description,
        achieved: feeCount === 0,
        progress: feeCount === 0 ? 100 : 0,
      },
      {
        id: 'saver-500',
        title: DEFINITIONS['saver-500'].title,
        description: DEFINITIONS['saver-500'].description,
        achieved: netCents >= 50000,
        progress: saverProgress,
        target: 500,
        current: toEuros(netCents),
      },
      {
        id: 'groceries-under-200',
        title: DEFINITIONS['groceries-under-200'].title,
        description: DEFINITIONS['groceries-under-200'].description,
        achieved: grocerySpendCents < 20000,
        progress: groceriesProgress,
        target: 200,
        current: toEuros(grocerySpendCents),
      },
      {
        id: 'streak-7',
        title: DEFINITIONS['streak-7'].title,
        description: DEFINITIONS['streak-7'].description,
        achieved: streak >= 7,
        progress: streakProgress,
        target: 7,
        current: streak,
      },
    ];

    res.json({ data: achievementsList, month });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'achievements_failed' });
  }
});

export default achievements;

