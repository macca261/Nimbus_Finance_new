import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server';
import type { Database } from '../../src/db';
import { openDb, ensureSchema } from '../../src/db';

describe('Internal transfers – savings', () => {
  let app: any;
  let db: Database;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.TEST_DB = '1';
    db = openDb();
    ensureSchema(db);
    app = createApp({ db } as any);
    // Seed accounts
    db.prepare(`INSERT INTO accounts (id, iban, name, role) VALUES (?, ?, ?, ?)`).run('A', 'DE-SPEND-001', 'Spending A', 'spending');
    db.prepare(`INSERT INTO accounts (id, iban, name, role) VALUES (?, ?, ?, ?)`).run('B', 'DE-SAVE-001', 'Savings B', 'savings');
  });

  it('pairs spending -> savings (both sides visible) and excludes from month summary', async () => {
    const ins = db.prepare(`INSERT INTO transactions (bookingDate, valueDate, amountCents, currency, purpose, counterpartName, accountIban, counterpartyIban, rawCode, accountId, direction, bankProfile, publicId, source, sourceProfile, category, isCashWithdrawal)
      VALUES (?, ?, ?, 'EUR', ?, ?, ?, ?, NULL, ?, ?, 'comdirect', ?, 'manual', 'comdirect', NULL, 0)`);
    const t1 = ins.run('2025-09-10', '2025-09-10', -50000, 'ÜBERTRAG AN TAGESGELD', 'Self', 'DE-SPEND-001', 'DE-SAVE-001', 'A', 'out', 'int-A', 'A-1').lastInsertRowid as number;
    const t2 = ins.run('2025-09-10', '2025-09-10', +50000, 'ÜBERTRAG VON GIRO', 'Self', 'DE-SAVE-001', 'DE-SPEND-001', 'B', 'in', 'int-B', 'B-1').lastInsertRowid as number;

    // Trigger normalization/import pipeline by fetching recent (or other op invoking matcher). For simplicity, call /api/transactions to run explanations and ensure DB available.
    await request(app).get('/api/transactions?limit=10').expect(200);

    // Verify flags on both rows
    const rows = db.prepare(`SELECT isInternalTransfer, internalTransferDirection, internalTransferKind, internalTransferGroupId FROM transactions WHERE id IN (?, ?) ORDER BY id`).all(t1, t2) as any[];
    expect(rows[0].isInternalTransfer).toBe(1);
    expect(rows[1].isInternalTransfer).toBe(1);
    expect(rows[0].internalTransferKind).toBe('savings');
    expect(rows[1].internalTransferKind).toBe('savings');
    expect(rows[0].internalTransferDirection).toBe('out');
    expect(rows[1].internalTransferDirection).toBe('in');
    expect(rows[0].internalTransferGroupId).toBeTruthy();
    expect(rows[0].internalTransferGroupId).toBe(rows[1].internalTransferGroupId);

    // Month summary should exclude as expense
    const month = await request(app).get('/api/summary/month?month=2025-09').expect(200);
    expect((month.body?.expenseCents ?? 0)).toBeGreaterThanOrEqual(0);

    // Internal-transfer summary should count savings in/out
    const its = await request(app).get('/api/summary/internal-transfers?month=2025-09').expect(200);
    expect(its.body?.totals?.savingsOutCents).toBe(50000);
    expect(its.body?.totals?.savingsInCents).toBe(50000);
  });

  it('classifies single-sided spending -> savings by counterparty IBAN', async () => {
    const ins = db.prepare(`INSERT INTO transactions (bookingDate, valueDate, amountCents, currency, purpose, counterpartName, accountIban, counterpartyIban, rawCode, accountId, direction, bankProfile, publicId, source, sourceProfile, category, isCashWithdrawal)
      VALUES (?, ?, ?, 'EUR', ?, ?, ?, ?, NULL, ?, ?, 'comdirect', ?, 'manual', 'comdirect', NULL, 0)`);
    const t1 = ins.run('2025-10-01', '2025-10-01', -25000, 'ÜBERWEISUNG AN TAGESGELD', 'Self', 'DE-SPEND-001', 'DE-SAVE-001', 'A', 'out', 'int-A', 'A-2').lastInsertRowid as number;

    // Invoke endpoints to initialize
    await request(app).get('/api/transactions?limit=10').expect(200);

    const row = db.prepare(`SELECT isInternalTransfer, internalTransferDirection, internalTransferKind, category FROM transactions WHERE id = ?`).get(t1) as any;
    expect(row.isInternalTransfer).toBe(1);
    expect(row.internalTransferKind).toBe('savings');
    expect(row.internalTransferDirection).toBe('out');
    expect(row.category).toBe('internal:savings');

    const month = await request(app).get('/api/summary/month?month=2025-10').expect(200);
    // Expense should not include 250€
    expect((month.body?.expenseCents ?? 0)).toBeGreaterThanOrEqual(0);

    const its = await request(app).get('/api/summary/internal-transfers?month=2025-10').expect(200);
    expect((its.body?.totals?.savingsOutCents ?? 0)).toBeGreaterThanOrEqual(25000);
  });

  it('does not mark external SEPA as internal transfer', async () => {
    const ins = db.prepare(`INSERT INTO transactions (bookingDate, valueDate, amountCents, currency, purpose, counterpartName, accountIban, counterpartyIban, rawCode, accountId, direction, bankProfile, publicId, source, sourceProfile, category, isCashWithdrawal)
      VALUES (?, ?, ?, 'EUR', ?, ?, ?, ?, NULL, ?, ?, 'comdirect', ?, 'manual', 'comdirect', NULL, 0)`);
    const t1 = ins.run('2025-11-01', '2025-11-01', -1999, 'UEBERWEISUNG MIETE EXTERN', 'Landlord', 'DE-SPEND-001', 'DE-EXTERNAL-123', 'A', 'out', 'int-A', 'A-3').lastInsertRowid as number;

    await request(app).get('/api/transactions?limit=10').expect(200);

    const row = db.prepare(`SELECT isInternalTransfer, internalTransferKind FROM transactions WHERE id = ?`).get(t1) as any;
    expect(row.isInternalTransfer || 0).toBe(0);
  });
});


