import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../../src/server';
import { openDb, ensureSchema, insertTransactions } from '../../src/db';
import type { Database } from '../../src/db';

describe('Internal transfers detect savings via accounts role', () => {
  let db: Database;
  let app: any;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.TEST_DB = '1';
    db = openDb();
    ensureSchema(db);
    app = createApp({ db } as any);
  });

  it('uses accounts role to mark savings transfer and internal category', async () => {
    // Seed accounts: spending + savings
    db.prepare(`INSERT INTO accounts (id, iban, name, role) VALUES (?, ?, ?, 'spending')`).run('SPEND-A', 'DE-SPEND-A', 'Spending A');
    db.prepare(`INSERT INTO accounts (id, iban, name, role) VALUES (?, ?, ?, 'savings')`).run('SAVE-A', 'DE-SAVE-A', 'Savings A');

    // Insert batch: outflow from spending to savings IBAN; inflow on savings
    const batch = [
      {
        bookingDate: '2025-11-10',
        valueDate: '2025-11-10',
        amountCents: -50000,
        currency: 'EUR',
        purpose: 'Übertrag an Tagesgeld',
        counterpartName: 'Ich',
        accountIban: 'DE-SPEND-A',
        counterpartyIban: 'DE-SAVE-A',
        accountId: 'SPEND-A',
        payee: 'Ich',
        source: 'manual',
        sourceProfile: 'comdirect',
      },
      {
        bookingDate: '2025-11-10',
        valueDate: '2025-11-10',
        amountCents: +50000,
        currency: 'EUR',
        purpose: 'Übertrag von Giro',
        counterpartName: 'Ich',
        accountIban: 'DE-SAVE-A',
        counterpartyIban: 'DE-SPEND-A',
        accountId: 'SAVE-A',
        payee: 'Ich',
        source: 'manual',
        sourceProfile: 'comdirect',
      },
    ];
    const res = insertTransactions(batch as any, db);
    expect(res.inserted).toBeGreaterThanOrEqual(2);

    const rows = db.prepare(`SELECT isInternalTransfer, internalTransferKind, category FROM transactions ORDER BY id`).all() as any[];
    expect(rows[0].isInternalTransfer).toBe(1);
    expect(rows[1].isInternalTransfer).toBe(1);
    expect(rows[0].internalTransferKind).toBe('savings');
    expect(rows[1].internalTransferKind).toBe('savings');
    // Engine override ensures internal transfer categories are internal:transfer_savings on categorize; insert-time mapping keeps internal categories too
    expect(rows.some(r => r.category === 'internal:transfer_savings' || r.category === 'internal:savings')).toBe(true);
  });
});


