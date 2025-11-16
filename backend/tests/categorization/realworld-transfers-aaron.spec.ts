import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server';
import type { Database } from '../../src/db';
import { openDb, ensureSchema } from '../../src/db';

describe('Real-world transfers – guard against Transport', () => {
  let app: any;
  let db: Database;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.TEST_DB = '1';
    db = openDb();
    ensureSchema(db);
    app = createApp({ db } as any);
  });

  it('treats transfer to savings IBAN as internal:savings (single-sided)', async () => {
    // Seed accounts
    db.prepare(`INSERT INTO accounts (id, iban, name, role) VALUES (?, ?, ?, ?)`).run('SPEND-A', 'DE-SPEND-A', 'Spending', 'spending');
    db.prepare(`INSERT INTO accounts (id, iban, name, role) VALUES (?, ?, ?, ?)`).run('SAVE-A', 'DE32200411770270381700', 'Savings', 'savings');

    // Insert single-sided outgoing transfer from spending to savings IBAN
    const stmt = db.prepare(`INSERT INTO transactions (bookingDate, valueDate, amountCents, currency, purpose, counterpartName, accountIban, counterpartyIban, rawCode, accountId, direction, bankProfile, publicId, source, sourceProfile, category)
      VALUES (?, ?, ?, 'EUR', ?, ?, ?, ?, NULL, ?, ?, 'comdirect', ?, 'manual', 'comdirect', NULL)`);
    const text = 'Übertrag / Überweisung | Empfänger: Aaron McIntoshKto/IBAN: DE32200411770270381700 BLZ/BIC: COBAD... Ref. ...';
    const id = stmt.run('2025-11-05', '2025-11-05', -12345, text, 'Aaron McIntosh', 'DE-SPEND-A', 'DE32200411770270381700', 'SPEND-A', 'out', 'int', 'tx-1').lastInsertRowid as number;

    await request(app).get('/api/transactions?limit=5').expect(200);
    const row = db.prepare(`SELECT isInternalTransfer, internalTransferKind, internalTransferDirection, category FROM transactions WHERE id = ?`).get(id) as any;
    expect(row.isInternalTransfer).toBe(1);
    expect(row.internalTransferKind).toBe('savings');
    expect(row.internalTransferDirection).toBe('out');
    expect(row.category).toBe('internal:savings');

    const month = await request(app).get('/api/summary/month?month=2025-11').expect(200);
    expect((month.body?.expenseCents ?? 0)).toBeGreaterThanOrEqual(0);
    const its = await request(app).get('/api/summary/internal-transfers?month=2025-11').expect(200);
    expect((its.body?.totals?.savingsOutCents ?? 0)).toBeGreaterThanOrEqual(12345);
  });

  it('does not classify partner transfer as Transport if IBAN is unknown', async () => {
    db.prepare(`INSERT INTO accounts (id, iban, name, role) VALUES (?, ?, ?, ?)`).run('SPEND-B', 'DE-SPEND-B', 'Spending B', 'spending');
    const stmt = db.prepare(`INSERT INTO transactions (bookingDate, valueDate, amountCents, currency, purpose, counterpartName, accountIban, counterpartyIban, rawCode, accountId, direction, bankProfile, publicId, source, sourceProfile, category)
      VALUES (?, ?, ?, 'EUR', ?, ?, ?, ?, NULL, ?, ?, 'comdirect', ?, 'manual', 'comdirect', NULL)`);
    const text = 'Übertrag / Überweisung | Empfänger: Rukiye AksoyKto/IBAN: DE1234567890 BLZ/BIC: ANYBANK Ref. ...';
    const id = stmt.run('2025-11-06', '2025-11-06', -5000, text, 'Rukiye Aksoy', 'DE-SPEND-B', 'DE1234567890', 'SPEND-B', 'out', 'int', 'tx-2').lastInsertRowid as number;

    await request(app).get('/api/transactions?limit=5').expect(200);
    const row = db.prepare(`SELECT isInternalTransfer, category FROM transactions WHERE id = ?`).get(id) as any;
    expect(row.isInternalTransfer || 0).toBe(0);
    // Should not be categorized as transport by generic bank transfer guard
    const cat = (row.category || '').toString();
    expect(cat.startsWith('transport')).toBe(false);
  });
});


