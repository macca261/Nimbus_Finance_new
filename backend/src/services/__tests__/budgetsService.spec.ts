import { describe, it, expect, beforeEach } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import { calculateBudgetSummary } from '../budgetsService';
import type { Budget, BudgetCategoryAllocation } from '@prisma/client';

describe('budgetsService', () => {
  let db: BetterSqliteDatabase;

  beforeEach(() => {
    // Create in-memory database for tests
    db = new BetterSqlite3(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY,
        bookingDate TEXT NOT NULL,
        amountCents INTEGER NOT NULL,
        category TEXT,
        isInternalTransfer INTEGER DEFAULT 0,
        isPassThrough INTEGER DEFAULT 0,
        isCashWithdrawal INTEGER DEFAULT 0,
        isReimbursement INTEGER DEFAULT 0
      );
    `);
  });

  afterEach(() => {
    db.close();
  });

  it('calculates budget summary with no transactions', () => {
    const budget: Budget & { allocations: BudgetCategoryAllocation[] } = {
      id: 'budget-1',
      name: 'Test Budget',
      period: 'monthly',
      periodValue: '2025-01',
      currency: 'EUR',
      rolloverEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      allocations: [
        {
          id: 'alloc-1',
          budgetId: 'budget-1',
          categoryId: 'groceries',
          plannedCents: 50000, // 500 EUR
          rolloverFromPrevious: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };

    const summary = calculateBudgetSummary(budget, db);

    expect(summary.totalPlannedCents).toBe(50000);
    expect(summary.totalSpentCents).toBe(0);
    expect(summary.totalRemainingCents).toBe(50000);
    expect(summary.overspendCount).toBe(0);
    expect(summary.allocations[0].spentCents).toBe(0);
    expect(summary.allocations[0].remainingCents).toBe(50000);
    expect(summary.allocations[0].isOverspent).toBe(false);
  });

  it('calculates budget summary with overspend', () => {
    // Insert transaction that exceeds budget
    db.prepare(
      `INSERT INTO transactions (bookingDate, amountCents, category) VALUES (?, ?, ?)`
    ).run('2025-01-15', -60000, 'groceries'); // -600 EUR

    const budget: Budget & { allocations: BudgetCategoryAllocation[] } = {
      id: 'budget-1',
      name: 'Test Budget',
      period: 'monthly',
      periodValue: '2025-01',
      currency: 'EUR',
      rolloverEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      allocations: [
        {
          id: 'alloc-1',
          budgetId: 'budget-1',
          categoryId: 'groceries',
          plannedCents: 50000, // 500 EUR
          rolloverFromPrevious: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };

    const summary = calculateBudgetSummary(budget, db);

    expect(summary.totalSpentCents).toBe(60000);
    expect(summary.totalRemainingCents).toBe(-10000); // Negative = overspend
    expect(summary.overspendCount).toBe(1);
    expect(summary.allocations[0].isOverspent).toBe(true);
    expect(summary.allocations[0].progressPercent).toBeGreaterThan(100);
  });

  it('excludes internal transfers and pass-through transactions', () => {
    // Insert transactions that should be excluded
    db.prepare(
      `INSERT INTO transactions (bookingDate, amountCents, category, isInternalTransfer) VALUES (?, ?, ?, ?)`
    ).run('2025-01-15', -10000, 'groceries', 1);
    db.prepare(
      `INSERT INTO transactions (bookingDate, amountCents, category, isPassThrough) VALUES (?, ?, ?, ?)`
    ).run('2025-01-16', -5000, 'groceries', 1);
    // Insert valid transaction
    db.prepare(
      `INSERT INTO transactions (bookingDate, amountCents, category) VALUES (?, ?, ?)`
    ).run('2025-01-17', -20000, 'groceries');

    const budget: Budget & { allocations: BudgetCategoryAllocation[] } = {
      id: 'budget-1',
      name: 'Test Budget',
      period: 'monthly',
      periodValue: '2025-01',
      currency: 'EUR',
      rolloverEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      allocations: [
        {
          id: 'alloc-1',
          budgetId: 'budget-1',
          categoryId: 'groceries',
          plannedCents: 50000,
          rolloverFromPrevious: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };

    const summary = calculateBudgetSummary(budget, db);

    // Should only count the valid transaction (20000), not the excluded ones
    expect(summary.totalSpentCents).toBe(20000);
  });
});

