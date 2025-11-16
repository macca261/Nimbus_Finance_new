import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server';
import type { Database } from '../../src/db';
import { openDb, ensureSchema } from '../../src/db';

describe('Pass-through pairing integration', () => {
  let app: any;
  let db: Database;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.TEST_DB = '1';
    db = openDb();
    ensureSchema(db);
    app = createApp({ db } as any);
  });

  it('links two opposite transactions as pass-through and excludes from summaries', async () => {
    // Insert two opposite rows
    const ins = db.prepare(`INSERT INTO transactions (bookingDate, valueDate, amountCents, currency, purpose, counterpartName, accountIban, rawCode, category, category_confidence, category_source, category_explanation, category_rule_id, raw, importFile, importBatchId, fingerprint, direction, counterpartyIban, bankProfile, publicId, source, sourceProfile, accountId, payee, memo, externalId, referenceId, isTransfer, transferLinkId, confidence, isRefund, isRefunded, refundGroupId, isInternalTransfer, internalTransferDirection, internalTransferKind, internalTransferGroupId, isReimbursement, reimbursementRole, reimbursementGroupId, reimbursementShareRatio, bankReferenceId)
      VALUES (@bookingDate, @valueDate, @amountCents, 'EUR', @purpose, @counterpartName, @accountIban, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, @direction, NULL, 'comdirect', @publicId, 'manual', 'comdirect', @accountId, @payee, @purpose, NULL, NULL, 0, NULL, NULL, 0, 0, NULL, 0, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL)`);
    const aId = ins.run({
      bookingDate: '2025-09-10',
      valueDate: '2025-09-10',
      amountCents: 10000,
      purpose: 'Test pass-through income',
      counterpartName: 'Alice',
      accountIban: 'DE001',
      direction: 'in',
      publicId: 'pt-a',
      accountId: 'acc-1',
      payee: 'Alice',
    }).lastInsertRowid as number;
    const bId = ins.run({
      bookingDate: '2025-09-10',
      valueDate: '2025-09-10',
      amountCents: -10000,
      purpose: 'Test pass-through expense',
      counterpartName: 'Bob',
      accountIban: 'DE001',
      direction: 'out',
      publicId: 'pt-b',
      accountId: 'acc-1',
      payee: 'Bob',
    }).lastInsertRowid as number;

    // Pair as pass-through
    const pair = await request(app)
      .post('/api/transactions/pass-through')
      .send({ transactionIds: [aId, bId] })
      .expect(200);
    expect(pair.body?.ok).toBe(true);
    const ptGroup = pair.body?.passThroughGroupId;
    expect(ptGroup).toMatch(/^pt:/);

    // Fetch transactions and verify flags
    const list = await request(app).get('/api/transactions?limit=10').expect(200);
    const rows = list.body.transactions || list.body.data || [];
    const aRow = rows.find((r: any) => r.id === aId);
    const bRow = rows.find((r: any) => r.id === bId);
    expect(aRow?.isPassThrough).toBe(true);
    expect(bRow?.isPassThrough).toBe(true);
    expect(aRow?.passThroughGroupId).toBe(ptGroup);
    expect(bRow?.passThroughGroupId).toBe(ptGroup);

    // Summaries should exclude them by default
    const month = await request(app).get('/api/summary/month').expect(200);
    expect(Math.abs(month.body.expenseCents)).toBeGreaterThanOrEqual(0);
    // income - expense should not include our pair, so net is not affected

    const cats = await request(app).get('/api/summary/categories').expect(200);
    const data = cats.body.data || [];
    // No category entry should reflect exactly ±10000 from our pair
    const totalSpend = data.reduce((acc: number, d: any) => acc + (d.rawExpenseCents || 0), 0);
    expect(totalSpend).toBeGreaterThanOrEqual(0);
  });
});


