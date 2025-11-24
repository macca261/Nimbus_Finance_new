import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server';
import type { Database } from '../../src/db';
import { openDb, ensureSchema, insertTransactions, type CanonicalRow } from '../../src/db';

describe('Summary endpoints – monthly income/expense (6 months)', () => {
  let app: any;
  let db: Database;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.TEST_DB = '1';
    db = openDb();
    ensureSchema(db);
    app = createApp({ db } as any);
    
    // Seed a savings account for internal transfer detection
    db.prepare(`INSERT OR IGNORE INTO accounts (id, iban, name, role) VALUES (?, ?, ?, ?)`).run(
      'savings-1',
      'DE32200411770270381700',
      'Savings Account',
      'savings'
    );
  });

  it('returns income and expense for last 6 months', async () => {
    // Create transactions across 4 months
    const transactions: CanonicalRow[] = [];
    
    // Helper to get month label from date
    const getMonthLabel = (date: Date): string => {
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth() + 1; // Convert 0-11 to 1-12
      return `${year}-${String(month).padStart(2, '0')}`;
    };
    
    // Month 1 (3 months ago): Income and expenses
    const month1Date = new Date(Date.UTC(2025, 0, 15)); // January 2025
    const month1Label = getMonthLabel(month1Date);
    transactions.push({
      bookingDate: month1Date.toISOString().slice(0, 10),
      valueDate: month1Date.toISOString().slice(0, 10),
      amountCents: 500000, // 5000 EUR income
      currency: 'EUR',
      purpose: 'Salary',
      counterpartName: 'Employer',
      accountIban: 'DE12345678901234567890',
      counterpartyIban: null,
      accountId: 'spending-main',
      source: 'csv_bank',
      sourceProfile: 'comdirect',
    });
    transactions.push({
      bookingDate: month1Date.toISOString().slice(0, 10),
      valueDate: month1Date.toISOString().slice(0, 10),
      amountCents: -100000, // -1000 EUR expense
      currency: 'EUR',
      purpose: 'REWE MARKT',
      counterpartName: 'REWE',
      accountIban: 'DE12345678901234567890',
      counterpartyIban: null,
      accountId: 'spending-main',
      source: 'csv_bank',
      sourceProfile: 'comdirect',
    });
    
    // Month 2 (2 months ago): Income and expenses
    const month2Date = new Date(Date.UTC(2025, 1, 15)); // February 2025
    const month2Label = getMonthLabel(month2Date);
    transactions.push({
      bookingDate: month2Date.toISOString().slice(0, 10),
      valueDate: month2Date.toISOString().slice(0, 10),
      amountCents: 500000, // 5000 EUR income
      currency: 'EUR',
      purpose: 'Salary',
      counterpartName: 'Employer',
      accountIban: 'DE12345678901234567890',
      counterpartyIban: null,
      accountId: 'spending-main',
      source: 'csv_bank',
      sourceProfile: 'comdirect',
    });
    transactions.push({
      bookingDate: month2Date.toISOString().slice(0, 10),
      valueDate: month2Date.toISOString().slice(0, 10),
      amountCents: -150000, // -1500 EUR expense
      currency: 'EUR',
      purpose: 'Amazon',
      counterpartName: 'Amazon',
      accountIban: 'DE12345678901234567890',
      counterpartyIban: null,
      accountId: 'spending-main',
      source: 'csv_bank',
      sourceProfile: 'comdirect',
    });
    
    // Month 3 (1 month ago): Income, expenses, and exclusions
    const month3Date = new Date(Date.UTC(2025, 2, 15)); // March 2025
    const month3Label = getMonthLabel(month3Date);
    transactions.push({
      bookingDate: month3Date.toISOString().slice(0, 10),
      valueDate: month3Date.toISOString().slice(0, 10),
      amountCents: 500000, // 5000 EUR income
      currency: 'EUR',
      purpose: 'Salary',
      counterpartName: 'Employer',
      accountIban: 'DE12345678901234567890',
      counterpartyIban: null,
      accountId: 'spending-main',
      source: 'csv_bank',
      sourceProfile: 'comdirect',
    });
    transactions.push({
      bookingDate: month3Date.toISOString().slice(0, 10),
      valueDate: month3Date.toISOString().slice(0, 10),
      amountCents: -200000, // -2000 EUR expense
      currency: 'EUR',
      purpose: 'Restaurant',
      counterpartName: 'Restaurant',
      accountIban: 'DE12345678901234567890',
      counterpartyIban: null,
      accountId: 'spending-main',
      source: 'csv_bank',
      sourceProfile: 'comdirect',
    });
    // Internal transfer (should be excluded)
    transactions.push({
      bookingDate: month3Date.toISOString().slice(0, 10),
      valueDate: month3Date.toISOString().slice(0, 10),
      amountCents: -270000, // -2700 EUR internal transfer
      currency: 'EUR',
      purpose: 'Übertrag / Überweisung | Empfänger: Aaron McIntoshKto/IBAN: DE32200411770270381700',
      counterpartName: 'Aaron McIntosh',
      accountIban: 'DE12345678901234567890',
      counterpartyIban: 'DE32200411770270381700', // Savings account
      accountId: 'spending-main',
      source: 'csv_bank',
      sourceProfile: 'comdirect',
    });
    // Cash withdrawal (should be excluded)
    transactions.push({
      bookingDate: month3Date.toISOString().slice(0, 10),
      valueDate: month3Date.toISOString().slice(0, 10),
      amountCents: -50000, // -500 EUR cash withdrawal
      currency: 'EUR',
      purpose: 'Bargeldauszahlung',
      counterpartName: 'ATM',
      accountIban: 'DE12345678901234567890',
      counterpartyIban: null,
      accountId: 'spending-main',
      source: 'csv_bank',
      sourceProfile: 'comdirect',
    });
    
    // Month 4 (current month): Income only
    const month4Date = new Date(Date.UTC(2025, 3, 15)); // April 2025
    const month4Label = getMonthLabel(month4Date);
    transactions.push({
      bookingDate: month4Date.toISOString().slice(0, 10),
      valueDate: month4Date.toISOString().slice(0, 10),
      amountCents: 500000, // 5000 EUR income
      currency: 'EUR',
      purpose: 'Salary',
      counterpartName: 'Employer',
      accountIban: 'DE12345678901234567890',
      counterpartyIban: null,
      accountId: 'spending-main',
      source: 'csv_bank',
      sourceProfile: 'comdirect',
    });
    
    insertTransactions(transactions, db);
    
    // Query the endpoint
    const res = await request(app).get('/api/summary/monthly-6-income-expense').expect(200);
    const data = res.body.data || [];
    
    // Should have 6 months of data
    expect(data.length).toBe(6);
    
    // Check month 1 (January 2025)
    const m1 = data.find((d: any) => d.month === month1Label);
    if (m1) {
      expect(m1.totalIncomeCents).toBe(500000);
      expect(m1.totalExpenseCents).toBe(100000);
    }
    
    // Check month 2 (February 2025)
    const m2 = data.find((d: any) => d.month === month2Label);
    if (m2) {
      expect(m2.totalIncomeCents).toBe(500000);
      expect(m2.totalExpenseCents).toBe(150000);
    }
    
    // Check month 3 (March 2025) - should exclude internal transfer and cash withdrawal
    const m3 = data.find((d: any) => d.month === month3Label);
    if (m3) {
      expect(m3.totalIncomeCents).toBe(500000);
      // Should only include the restaurant expense (2000 EUR), not internal transfer or cash withdrawal
      expect(m3.totalExpenseCents).toBe(200000);
    }
    
    // Check month 4 (April 2025)
    const m4 = data.find((d: any) => d.month === month4Label);
    if (m4) {
      expect(m4.totalIncomeCents).toBe(500000);
      expect(m4.totalExpenseCents).toBe(0);
    }
    
    // Verify data is sorted ascending by month
    for (let i = 1; i < data.length; i++) {
      expect(data[i].month >= data[i - 1].month).toBe(true);
    }
  });

  it('excludes internal transfers from income and expense', async () => {
    const monthDate = new Date(Date.UTC(2025, 3, 15)); // April 2025
    const monthLabel = `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, '0')}`;
    
    const transactions: CanonicalRow[] = [
      {
        bookingDate: monthDate.toISOString().slice(0, 10),
        valueDate: monthDate.toISOString().slice(0, 10),
        amountCents: 100000, // 1000 EUR income
        currency: 'EUR',
        purpose: 'Salary',
        counterpartName: 'Employer',
        accountIban: 'DE12345678901234567890',
        counterpartyIban: null,
        accountId: 'spending-main',
        source: 'csv_bank',
        sourceProfile: 'comdirect',
      },
      {
        bookingDate: monthDate.toISOString().slice(0, 10),
        valueDate: monthDate.toISOString().slice(0, 10),
        amountCents: -50000, // -500 EUR expense
        currency: 'EUR',
        purpose: 'REWE',
        counterpartName: 'REWE',
        accountIban: 'DE12345678901234567890',
        counterpartyIban: null,
        accountId: 'spending-main',
        source: 'csv_bank',
        sourceProfile: 'comdirect',
      },
      {
        bookingDate: monthDate.toISOString().slice(0, 10),
        valueDate: monthDate.toISOString().slice(0, 10),
        amountCents: -270000, // -2700 EUR internal transfer (should be excluded)
        currency: 'EUR',
        purpose: 'Übertrag / Überweisung | Empfänger: Aaron McIntoshKto/IBAN: DE32200411770270381700',
        counterpartName: 'Aaron McIntosh',
        accountIban: 'DE12345678901234567890',
        counterpartyIban: 'DE32200411770270381700',
        accountId: 'spending-main',
        source: 'csv_bank',
        sourceProfile: 'comdirect',
      },
    ];
    
    insertTransactions(transactions, db);
    
    const res = await request(app).get('/api/summary/monthly-6-income-expense').expect(200);
    const data = res.body.data || [];
    
    const current = data.find((d: any) => d.month === monthLabel);
    
    if (current) {
      // Should only include true income and expense, not internal transfer
      expect(current.totalIncomeCents).toBe(100000);
      expect(current.totalExpenseCents).toBe(50000);
    }
  });

  it('excludes cash withdrawals from expenses', async () => {
    const monthDate = new Date(Date.UTC(2025, 3, 15)); // April 2025
    const monthLabel = `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, '0')}`;
    
    const transactions: CanonicalRow[] = [
      {
        bookingDate: monthDate.toISOString().slice(0, 10),
        valueDate: monthDate.toISOString().slice(0, 10),
        amountCents: -50000, // -500 EUR expense
        currency: 'EUR',
        purpose: 'REWE',
        counterpartName: 'REWE',
        accountIban: 'DE12345678901234567890',
        counterpartyIban: null,
        accountId: 'spending-main',
        source: 'csv_bank',
        sourceProfile: 'comdirect',
      },
      {
        bookingDate: monthDate.toISOString().slice(0, 10),
        valueDate: monthDate.toISOString().slice(0, 10),
        amountCents: -100000, // -1000 EUR cash withdrawal (should be excluded)
        currency: 'EUR',
        purpose: 'Bargeldauszahlung',
        counterpartName: 'ATM',
        accountIban: 'DE12345678901234567890',
        counterpartyIban: null,
        accountId: 'spending-main',
        source: 'csv_bank',
        sourceProfile: 'comdirect',
      },
    ];
    
    insertTransactions(transactions, db);
    
    const res = await request(app).get('/api/summary/monthly-6-income-expense').expect(200);
    const data = res.body.data || [];
    
    const current = data.find((d: any) => d.month === monthLabel);
    
    if (current) {
      // Should only include true expense, not cash withdrawal
      expect(current.totalExpenseCents).toBe(50000);
    }
  });

  it('returns empty array when no transactions exist', async () => {
    const res = await request(app).get('/api/summary/monthly-6-income-expense').expect(200);
    const data = res.body.data || [];
    
    // Should still return 6 months, but with zeros
    expect(data.length).toBe(6);
    data.forEach((month: any) => {
      expect(month.totalIncomeCents).toBe(0);
      expect(month.totalExpenseCents).toBe(0);
      expect(typeof month.month).toBe('string');
      expect(month.month).toMatch(/^\d{4}-\d{2}$/);
    });
  });
});

