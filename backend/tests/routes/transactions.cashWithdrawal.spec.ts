import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server';
import type { Database } from '../../src/db';
import { openDb, ensureSchema } from '../../src/db';

describe('Transactions API - cash withdrawal category override', () => {
  let app: any;
  let db: Database;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.TEST_DB = '1';
    db = openDb();
    ensureSchema(db);
    app = createApp({ db } as any);
  });

  it('forces cash_withdrawal category for rows with isCashWithdrawal=1, even if DB category is "other"', async () => {
    // Insert a transaction with category='other' but isCashWithdrawal=1
    // This simulates a legacy/stale row that hasn't been updated yet
    const insertStmt = db.prepare(`
      INSERT INTO transactions (
        bookingDate, valueDate, amountCents, currency, purpose, counterpartName,
        category, isCashWithdrawal
      ) VALUES (?, ?, ?, 'EUR', ?, ?, ?, ?)
    `);
    
    const txId = insertStmt.run(
      '2025-09-26',
      '2025-09-26',
      -5000,
      'Auszahlung GAA | Auftraggeber: DEUTSCHE BANK Buchungstext: Bargeldauszahlung Deutsche Bank//Köln/DE',
      'DEUTSCHE BANK',
      'other', // DB category is still 'other'
      1 // but isCashWithdrawal flag is set
    ).lastInsertRowid as number;

    // Call GET /api/transactions
    const res = await request(app).get('/api/transactions?limit=10').expect(200);
    
    const transactions = res.body?.transactions ?? [];
    const tx = transactions.find((t: any) => t.id === txId);
    
    expect(tx).toBeDefined();
    expect(tx.category).toBe('cash_withdrawal'); // Should be overridden
    expect(tx.isCashWithdrawal).toBe(true);
  });

  it('includes isCashWithdrawal in API response for cash withdrawal transactions', async () => {
    const insertStmt = db.prepare(`
      INSERT INTO transactions (
        bookingDate, valueDate, amountCents, currency, purpose, counterpartName,
        category, isCashWithdrawal
      ) VALUES (?, ?, ?, 'EUR', ?, ?, ?, ?)
    `);
    
    const txId = insertStmt.run(
      '2025-09-26',
      '2025-09-26',
      -5000,
      'Bargeldauszahlung Deutsche Bank ATM',
      'DEUTSCHE BANK',
      'cash_withdrawal',
      1
    ).lastInsertRowid as number;

    const res = await request(app).get('/api/transactions/recent?limit=10').expect(200);
    
    const transactions = res.body?.transactions ?? [];
    const tx = transactions.find((t: any) => t.id === txId);
    
    expect(tx).toBeDefined();
    expect(tx.category).toBe('cash_withdrawal');
    expect(tx.isCashWithdrawal).toBe(true);
  });

  it('does not override category for non-cash withdrawal transactions', async () => {
    const insertStmt = db.prepare(`
      INSERT INTO transactions (
        bookingDate, valueDate, amountCents, currency, purpose, counterpartName,
        category, isCashWithdrawal
      ) VALUES (?, ?, ?, 'EUR', ?, ?, ?, ?)
    `);
    
    const txId = insertStmt.run(
      '2025-09-27',
      '2025-09-27',
      -1500,
      'Kauf bei REWE',
      'REWE',
      'groceries',
      0 // Not a cash withdrawal
    ).lastInsertRowid as number;

    const res = await request(app).get('/api/transactions?limit=10').expect(200);
    
    const transactions = res.body?.transactions ?? [];
    const tx = transactions.find((t: any) => t.id === txId);
    
    expect(tx).toBeDefined();
    expect(tx.category).toBe('groceries'); // Should remain as-is
    expect(tx.isCashWithdrawal).toBe(false);
  });
});

