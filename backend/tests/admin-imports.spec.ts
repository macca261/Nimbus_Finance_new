import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/server';
import { db } from '../src/db';

const app = createApp({ db });

describe('admin imports API', () => {
  beforeEach(() => {
    db.exec('DELETE FROM transfer_links');
    db.exec('DELETE FROM transactions');
    db.exec('DELETE FROM imports');
  });

  it('lists recorded imports with identifiers', async () => {
    const batchId = 'batch-list-1';
    const insert = db.prepare(
      `INSERT INTO imports (profileId, fileName, confidence, transactionCount, warnings, batchId)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    insert.run('commerzbank_de', 'commerzbank.csv', 0.98, 12, JSON.stringify([]), batchId);

    const res = await request(app).get('/api/admin/imports');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.imports)).toBe(true);
    const first = res.body.imports[0];
    expect(first).toMatchObject({
      fileName: 'commerzbank.csv',
      profileId: 'commerzbank_de',
      batchId,
    });
    expect(typeof first.id).toBe('number');
  });

  it('deletes selected imports and cascades transactions', async () => {
    const batchId = 'batch-delete-1';
    const insertImport = db.prepare(
      `INSERT INTO imports (profileId, fileName, confidence, transactionCount, warnings, batchId)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const result = insertImport.run('n26_de', 'n26.csv', 0.92, 3, JSON.stringify([]), batchId);
    const importId = Number(result.lastInsertRowid);

    const insertTx = db.prepare(
      `INSERT INTO transactions (bookingDate, valueDate, amountCents, currency, purpose, importFile, importBatchId)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    insertTx.run('2025-09-01', '2025-09-01', -12345, 'EUR', 'Test 1', 'n26.csv', batchId);
    insertTx.run('2025-09-02', '2025-09-02', 67890, 'EUR', 'Test 2', 'n26.csv', batchId);

    const delRes = await request(app)
      .delete('/api/admin/imports')
      .send({ ids: [importId] });

    expect(delRes.status).toBe(200);
    expect(delRes.body).toMatchObject({ ok: true, deletedImports: 1, deletedTransactions: 2 });

    const remainingTx = db.prepare(`SELECT COUNT(1) AS c FROM transactions`).get() as { c: number };
    const remainingImports = db.prepare(`SELECT COUNT(1) AS c FROM imports`).get() as { c: number };

    expect(remainingTx.c).toBe(0);
    expect(remainingImports.c).toBe(0);
  });
});
