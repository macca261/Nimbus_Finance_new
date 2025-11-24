import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import { calculateGoalProgress } from '../goalsService';
import type { Goal } from '@prisma/client';

describe('goalsService', () => {
  let db: BetterSqliteDatabase;

  beforeEach(() => {
    db = new BetterSqlite3(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('calculates goal progress without target date', () => {
    const goal: Goal = {
      id: 'goal-1',
      name: 'Test Goal',
      type: 'savings',
      targetCents: 100000, // 1000 EUR
      currentCents: 50000, // 500 EUR
      targetDate: null,
      currency: 'EUR',
      linkedAccountIds: null,
      linkedCategoryIds: null,
      description: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const progress = calculateGoalProgress(goal, db);

    expect(progress.currentCents).toBe(50000);
    expect(progress.targetCents).toBe(100000);
    expect(progress.progressPercent).toBe(50);
    expect(progress.remainingCents).toBe(50000);
    expect(progress.status).toBe('no_target');
    expect(progress.requiredMonthlyCents).toBeNull();
  });

  it('calculates goal progress with target date', () => {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 6);

    const goal: Goal = {
      id: 'goal-1',
      name: 'Test Goal',
      type: 'savings',
      targetCents: 100000,
      currentCents: 50000,
      targetDate: futureDate,
      currency: 'EUR',
      linkedAccountIds: null,
      linkedCategoryIds: null,
      description: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const progress = calculateGoalProgress(goal, db);

    expect(progress.status).not.toBe('no_target');
    expect(progress.requiredMonthlyCents).not.toBeNull();
    expect(progress.requiredMonthlyCents).toBeGreaterThan(0);
  });

  it('marks completed goal correctly', () => {
    const goal: Goal = {
      id: 'goal-1',
      name: 'Test Goal',
      type: 'savings',
      targetCents: 100000,
      currentCents: 100000, // Already at target
      targetDate: null,
      currency: 'EUR',
      linkedAccountIds: null,
      linkedCategoryIds: null,
      description: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const progress = calculateGoalProgress(goal, db);

    expect(progress.progressPercent).toBe(100);
    expect(progress.status).toBe('completed');
  });

  it('handles goal with contributions history', () => {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 6);

    const goal: Goal = {
      id: 'goal-1',
      name: 'Test Goal',
      type: 'savings',
      targetCents: 100000,
      currentCents: 50000,
      targetDate: futureDate,
      currency: 'EUR',
      linkedAccountIds: null,
      linkedCategoryIds: null,
      description: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const history = [
      { date: new Date('2025-01-01'), amountCents: 10000 },
      { date: new Date('2025-02-01'), amountCents: 10000 },
      { date: new Date('2025-03-01'), amountCents: 10000 },
    ];

    const progress = calculateGoalProgress(goal, db, history);

    expect(progress.projectedCompletionDate).not.toBeNull();
  });
});

