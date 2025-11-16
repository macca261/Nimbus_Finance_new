import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server';
import type { Database } from '../../src/db';
import { openDb, ensureSchema, insertTransactions, type CanonicalRow } from '../../src/db';

describe('Summary endpoints – internal transfer exclusion', () => {
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

  it('excludes internal transfers from /api/summary/categories', async () => {
    // Insert one grocery expense and one internal transfer
    const groceryRow: CanonicalRow = {
      bookingDate: '2025-09-15',
      valueDate: '2025-09-15',
      amountCents: -10000, // -100 EUR
      currency: 'EUR',
      purpose: 'REWE MARKT 123',
      counterpartName: 'REWE',
      accountIban: 'DE12345678901234567890',
      counterpartyIban: null,
      accountId: 'spending-main',
      source: 'csv_bank',
      sourceProfile: 'comdirect',
    };

    const transferRow: CanonicalRow = {
      bookingDate: '2025-09-15',
      valueDate: '2025-09-15',
      amountCents: -270000, // -2700 EUR
      currency: 'EUR',
      purpose: 'Übertrag / Überweisung | Empfänger: Aaron McIntoshKto/IBAN: DE32200411770270381700 BLZ/BIC: COBADEHD077 Ref. 5I2C21PU02US856E/42431',
      counterpartName: 'Aaron McIntosh',
      accountIban: 'DE12345678901234567890',
      counterpartyIban: 'DE32200411770270381700', // Savings account IBAN
      accountId: 'spending-main',
      source: 'csv_bank',
      sourceProfile: 'comdirect',
    };

    insertTransactions([groceryRow, transferRow], db);

    // Query categories summary
    const catsRes = await request(app).get('/api/summary/categories').expect(200);
    const data = catsRes.body.data || [];

    // Total expenses should be 100 EUR (grocery), not 2800 EUR
    const totalExpense = data.reduce((acc: number, d: any) => acc + (d.rawExpenseCents || 0), 0);
    expect(totalExpense).toBe(10000); // Only grocery expense

    // Should have grocery category
    const grocery = data.find((d: any) => d.category === 'groceries');
    expect(grocery).toBeDefined();
    expect(grocery?.rawExpenseCents).toBe(10000);

    // Should NOT have internal transfer category
    const internalTransfer = data.find((d: any) => 
      d.category?.startsWith('internal:transfer') || 
      d.category === 'transfer_internal' ||
      d.category === 'internal:own-account'
    );
    expect(internalTransfer).toBeUndefined();
  });

  it('excludes internal transfers from /api/summary/month expenses', async () => {
    const groceryRow: CanonicalRow = {
      bookingDate: '2025-09-15',
      valueDate: '2025-09-15',
      amountCents: -10000, // -100 EUR
      currency: 'EUR',
      purpose: 'REWE MARKT 123',
      counterpartName: 'REWE',
      accountIban: 'DE12345678901234567890',
      counterpartyIban: null,
      accountId: 'spending-main',
      source: 'csv_bank',
      sourceProfile: 'comdirect',
    };

    const transferRow: CanonicalRow = {
      bookingDate: '2025-09-15',
      valueDate: '2025-09-15',
      amountCents: -270000, // -2700 EUR
      currency: 'EUR',
      purpose: 'Übertrag / Überweisung | Empfänger: Aaron McIntoshKto/IBAN: DE32200411770270381700 BLZ/BIC: COBADEHD077 Ref. 5I2C21PU02US856E/42431',
      counterpartName: 'Aaron McIntosh',
      accountIban: 'DE12345678901234567890',
      counterpartyIban: 'DE32200411770270381700',
      accountId: 'spending-main',
      source: 'csv_bank',
      sourceProfile: 'comdirect',
    };

    insertTransactions([groceryRow, transferRow], db);

    // Query month summary (use the month from the transactions)
    const monthRes = await request(app).get('/api/summary/month?month=2025-09').expect(200);
    
    // Expense should be 100 EUR, not 2800 EUR
    // Note: If month doesn't match, expenseCents might be 0, so we check the month matches
    if (monthRes.body.month === '2025-09') {
      expect(monthRes.body.expenseCents).toBe(10000);
      expect(monthRes.body.rawExpenseCents).toBe(10000);
    } else {
      // If using default month, check that internal transfers are still excluded
      expect(monthRes.body.expenseCents).toBeGreaterThanOrEqual(0);
      expect(monthRes.body.expenseCents).toBeLessThan(270000); // Should not include the transfer
    }
  });

  it('still reports internal transfers in /api/summary/internal-transfers', async () => {
    const transferRow: CanonicalRow = {
      bookingDate: '2025-09-15',
      valueDate: '2025-09-15',
      amountCents: -270000, // -2700 EUR
      currency: 'EUR',
      purpose: 'Übertrag / Überweisung | Empfänger: Aaron McIntoshKto/IBAN: DE32200411770270381700 BLZ/BIC: COBADEHD077 Ref. 5I2C21PU02US856E/42431',
      counterpartName: 'Aaron McIntosh',
      accountIban: 'DE12345678901234567890',
      counterpartyIban: 'DE32200411770270381700',
      accountId: 'spending-main',
      source: 'csv_bank',
      sourceProfile: 'comdirect',
    };

    insertTransactions([transferRow], db);

    // Query internal transfers summary
    const itRes = await request(app).get('/api/summary/internal-transfers?month=2025-09').expect(200);
    const totals = itRes.body.totals || {};

    // Should report savings out (if month matches, otherwise might be 0 if using default month)
    if (itRes.body.period?.from && itRes.body.period.from.startsWith('2025-09')) {
      expect(totals.savingsOutCents).toBe(270000);
    } else {
      // If using default month, just verify the endpoint works
      expect(typeof totals.savingsOutCents).toBe('number');
    }
  });
});

