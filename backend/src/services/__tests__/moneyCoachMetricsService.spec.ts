import { describe, it, expect, beforeEach } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import { getMoneyCoachMetrics } from '../moneyCoachMetricsService';
import type { Database } from '../../db';

describe('moneyCoachMetricsService', () => {
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
        purpose TEXT NOT NULL,
        counterpartName TEXT,
        accountIban TEXT,
        category TEXT,
        category_source TEXT,
        category_confidence REAL,
        createdAt TEXT
      );
    `);
  });

  it('returns valid structure with 0 transactions', async () => {
    const metrics = await getMoneyCoachMetrics(db, { days: 30 });

    expect(metrics).toBeDefined();
    expect(metrics.period).toBeDefined();
    expect(metrics.period.start).toBeDefined();
    expect(metrics.period.end).toBeDefined();
    expect(metrics.totalIncomeCents).toBe(0);
    expect(metrics.totalExpenseCents).toBe(0);
    expect(metrics.netCents).toBe(0);
    expect(metrics.topCategories).toEqual([]);
    expect(metrics.achievementsSummary).toBeDefined();
    expect(metrics.achievementsSummary?.completedCount).toBe(0);
  });

  it('calculates metrics correctly with transactions', async () => {
    // Insert test transactions
    const stmt = db.prepare(`
      INSERT INTO transactions (bookingDate, valueDate, amountCents, currency, purpose, category)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    stmt.run(today, today, 300000, 'EUR', 'Gehalt', 'income_salary');
    stmt.run(yesterday, yesterday, -5000, 'EUR', 'REWE', 'groceries');
    stmt.run(yesterday, yesterday, -2000, 'EUR', 'Netflix', 'subscriptions');

    const metrics = await getMoneyCoachMetrics(db, { days: 30 });

    expect(metrics.totalIncomeCents).toBe(300000);
    expect(metrics.totalExpenseCents).toBe(7000);
    expect(metrics.netCents).toBe(293000);
    expect(metrics.topCategories.length).toBeGreaterThan(0);
  });

  it('handles transactions with null category', async () => {
    const stmt = db.prepare(`
      INSERT INTO transactions (bookingDate, valueDate, amountCents, currency, purpose, category)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const today = new Date().toISOString().slice(0, 10);
    stmt.run(today, today, -1000, 'EUR', 'Unknown transaction', null);

    const metrics = await getMoneyCoachMetrics(db, { days: 30 });

    expect(metrics).toBeDefined();
    expect(metrics.totalExpenseCents).toBe(1000);
    // Transactions with null category should be grouped as 'other'
    const otherCategory = metrics.topCategories.find(cat => cat.categoryId === 'other');
    expect(otherCategory).toBeDefined();
  });

  it('uses correct date range based on latest transaction', async () => {
    const stmt = db.prepare(`
      INSERT INTO transactions (bookingDate, valueDate, amountCents, currency, purpose, category)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Insert transaction 10 days ago
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    stmt.run(tenDaysAgo, tenDaysAgo, -1000, 'EUR', 'Test', 'other');

    const metrics = await getMoneyCoachMetrics(db, { days: 30 });

    expect(metrics.period.end).toBe(tenDaysAgo);
    // Period start should be 30 days before the end (inclusive range, so diff is 30)
    const periodStartDate = new Date(metrics.period.start);
    const periodEndDate = new Date(metrics.period.end);
    const diffDays = Math.round((periodEndDate.getTime() - periodStartDate.getTime()) / (1000 * 60 * 60 * 24));
    // Allow 30-31 days due to date calculation edge cases
    expect(diffDays).toBeGreaterThanOrEqual(30);
    expect(diffDays).toBeLessThanOrEqual(31);
  });
});

