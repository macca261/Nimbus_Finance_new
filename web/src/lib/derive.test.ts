import { describe, expect, it } from 'vitest';
import type { TransactionDto } from './financeApi';
import {
  computeKpis,
  computeSpendingByCategory,
  computeDailyBalance,
} from './derive';

const sampleTx: TransactionDto[] = [
  { id: 1, bookedAt: '2025-03-01', amount: 2500, currency: 'EUR', category: 'income_salary' },
  { id: 2, bookedAt: '2025-03-05', amount: -120, currency: 'EUR', category: 'groceries' },
  { id: 3, bookedAt: '2025-03-08', amount: -60, currency: 'EUR', category: 'subscriptions' },
  { id: 4, bookedAt: '2025-04-02', amount: -80, currency: 'EUR', category: 'subscriptions' },
];

describe('derive helpers', () => {
  it('computes KPI summary with latest 30-day window', () => {
    const summary = computeKpis(sampleTx);
    expect(summary.currentBalance).toBeCloseTo(2240, 2);
    expect(summary.income30d).toBe(0); // Gehalt liegt außerhalb des 30 Tage Fensters
    expect(summary.expenses30d).toBeCloseTo(120 + 60 + 80, 2);
    expect(summary.net30d).toBeCloseTo(-(120 + 60 + 80), 2);
  });

  it('aggregates spending by category with top slices and other bucket', () => {
    const result = computeSpendingByCategory(sampleTx, { topN: 1 });
    expect(result.topSlices).toHaveLength(1);
    expect(result.topSlices[0].category).toBe('Abos & Mitgliedschaften');
    expect(result.topSlices[0].total).toBeCloseTo(140, 2);
    expect(result.otherSlice?.total).toBeCloseTo(120, 2);
  });

  it('computes daily balance time series across full range', () => {
    const points = computeDailyBalance(sampleTx);
    expect(points.length).toBeGreaterThan(0);
    expect(points[0].date).toBe('2025-03-01');
    expect(points.at(-1)?.date).toBe('2025-04-02');
    expect(points.at(-1)?.balance).toBeCloseTo(2240, 2);
  });
});

