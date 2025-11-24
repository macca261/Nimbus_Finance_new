import { describe, it, expect, beforeEach } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import { getMonthSummary } from '../monthSummaryService';
import type { Database } from '../../db';

describe('monthSummaryService', () => {
  let db: Database;

  beforeEach(() => {
    db = new BetterSqlite3(':memory:');
    // Create transactions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bookingDate TEXT NOT NULL,
        valueDate TEXT NOT NULL,
        amountCents INTEGER NOT NULL,
        currency TEXT NOT NULL,
        purpose TEXT,
        counterpartName TEXT,
        payee TEXT,
        memo TEXT,
        category TEXT,
        isRefund INTEGER DEFAULT 0,
        isRefunded INTEGER DEFAULT 0,
        isInternalTransfer INTEGER DEFAULT 0,
        isPassThrough INTEGER DEFAULT 0,
        isCashWithdrawal INTEGER DEFAULT 0,
        isReimbursement INTEGER DEFAULT 0,
        createdAt TEXT
      );
    `);
  });

  it('returns valid structure with 0 transactions', async () => {
    const now = new Date();
    const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const summary = await getMonthSummary(db, currentMonth);

    expect(summary).toBeDefined();
    expect(summary.period).toBeDefined();
    expect(summary.period.start).toBeDefined();
    expect(summary.period.end).toBeDefined();
    expect(summary.incomeCents).toBe(0);
    expect(summary.expenseCents).toBe(0);
    expect(summary.netCents).toBe(0);
    expect(summary.changeVsPrevMonthPct).toBeNull();
    expect(summary.topCategories).toEqual([]);
    expect(summary.biggestExpense).toBeNull();
    expect(summary.highlights).toEqual([]);
  });

  it('calculates metrics correctly for a month with transactions', async () => {
    const stmt = db.prepare(`
      INSERT INTO transactions (bookingDate, valueDate, amountCents, currency, purpose, category)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    // Insert transactions for current month
    const day1 = `${year}-${String(month).padStart(2, '0')}-01`;
    const day15 = `${year}-${String(month).padStart(2, '0')}-15`;

    stmt.run(day1, day1, 300000, 'EUR', 'Gehalt', 'income_salary');
    stmt.run(day15, day15, -5000, 'EUR', 'REWE', 'groceries');
    stmt.run(day15, day15, -2000, 'EUR', 'Netflix', 'subscriptions');

    const summary = await getMonthSummary(db, monthStr);

    expect(summary.incomeCents).toBe(300000);
    expect(summary.expenseCents).toBe(7000);
    expect(summary.netCents).toBe(293000);
    expect(summary.topCategories.length).toBeGreaterThan(0);
    expect(summary.biggestExpense).toBeDefined();
    expect(summary.biggestExpense?.amountCents).toBe(5000);
  });

  it('calculates change vs previous month correctly', async () => {
    const stmt = db.prepare(`
      INSERT INTO transactions (bookingDate, valueDate, amountCents, currency, purpose, category)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    // Previous month transactions
    const prevDay1 = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
    stmt.run(prevDay1, prevDay1, 300000, 'EUR', 'Gehalt', 'income_salary');
    stmt.run(prevDay1, prevDay1, -10000, 'EUR', 'Expenses', 'groceries');

    // Current month transactions
    const currentMonthStr = `${year}-${String(month).padStart(2, '0')}`;
    const currentDay1 = `${year}-${String(month).padStart(2, '0')}-01`;
    stmt.run(currentDay1, currentDay1, 300000, 'EUR', 'Gehalt', 'income_salary');
    stmt.run(currentDay1, currentDay1, -15000, 'EUR', 'Expenses', 'groceries');

    const summary = await getMonthSummary(db, currentMonthStr);

    expect(summary.changeVsPrevMonthPct).not.toBeNull();
    // Net: 290000 (prev) vs 285000 (current) = -5000 change
    // Percentage: -5000 / 290000 = -1.72%
    expect(summary.changeVsPrevMonthPct).toBeLessThan(0);
  });

  it('excludes internal transfers, refunds, and cash withdrawals', async () => {
    const stmt = db.prepare(`
      INSERT INTO transactions (bookingDate, valueDate, amountCents, currency, purpose, category, isInternalTransfer, isRefund, isCashWithdrawal)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const day1 = `${year}-${String(month).padStart(2, '0')}-01`;

    // Regular transaction
    stmt.run(day1, day1, -5000, 'EUR', 'REWE', 'groceries', 0, 0, 0);

    // Internal transfer (should be excluded)
    stmt.run(day1, day1, -10000, 'EUR', 'Transfer', 'transfer_internal', 1, 0, 0);

    // Refund (should be excluded)
    stmt.run(day1, day1, 2000, 'EUR', 'Refund', 'groceries', 0, 1, 0);

    // Cash withdrawal (should be excluded)
    stmt.run(day1, day1, -500, 'EUR', 'ATM', 'cash_withdrawal', 0, 0, 1);

    const summary = await getMonthSummary(db, monthStr);

    // Only the regular transaction should be counted
    expect(summary.expenseCents).toBe(5000);
    expect(summary.topCategories.length).toBe(1);
    expect(summary.topCategories[0].categoryId).toBe('groceries');
  });

  it('computes displayName correctly from transaction fields', async () => {
    const stmt = db.prepare(`
      INSERT INTO transactions (bookingDate, valueDate, amountCents, currency, purpose, counterpartName, payee, memo, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const day1 = `${year}-${String(month).padStart(2, '0')}-01`;

    // Transaction with payee (highest priority)
    stmt.run(day1, day1, -5000, 'EUR', 'Purpose text', 'Counterpart', 'REWE Markt', null, 'groceries');

    const summary = await getMonthSummary(db, monthStr);

    expect(summary.biggestExpense).toBeDefined();
    expect(summary.biggestExpense?.displayName).toBe('REWE Markt');
  });

  it('calculates top categories with correct share percentages', async () => {
    const stmt = db.prepare(`
      INSERT INTO transactions (bookingDate, valueDate, amountCents, currency, purpose, category)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const day1 = `${year}-${String(month).padStart(2, '0')}-01`;

    // Total expenses: 10000
    stmt.run(day1, day1, -6000, 'EUR', 'Groceries', 'groceries'); // 60%
    stmt.run(day1, day1, -3000, 'EUR', 'Transport', 'transport'); // 30%
    stmt.run(day1, day1, -1000, 'EUR', 'Other', 'other'); // 10%

    const summary = await getMonthSummary(db, monthStr);

    expect(summary.topCategories.length).toBe(3);
    expect(summary.topCategories[0].sharePct).toBeCloseTo(60, 1);
    expect(summary.topCategories[1].sharePct).toBeCloseTo(30, 1);
    expect(summary.topCategories[2].sharePct).toBeCloseTo(10, 1);
  });

  it('generates highlights for significant category shares', async () => {
    const stmt = db.prepare(`
      INSERT INTO transactions (bookingDate, valueDate, amountCents, currency, purpose, category)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const day1 = `${year}-${String(month).padStart(2, '0')}-01`;

    // Category with >30% share
    stmt.run(day1, day1, -5000, 'EUR', 'Groceries', 'groceries'); // 50% of 10000
    stmt.run(day1, day1, -5000, 'EUR', 'Other', 'other');

    const summary = await getMonthSummary(db, monthStr);

    const topCategoryHighlight = summary.highlights.find(h => h.type === 'top_category');
    expect(topCategoryHighlight).toBeDefined();
    expect((topCategoryHighlight?.data.sharePct as number)).toBeGreaterThan(30);
  });
});

