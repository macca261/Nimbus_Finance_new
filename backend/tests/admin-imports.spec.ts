import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/server';
import { db } from '../src/db';

const app = createApp({ db });

function resetTables() {
  db.exec('DELETE FROM transfer_links');
  db.exec('DELETE FROM transactions');
  db.exec('DELETE FROM imports');
}

const insertImport = db.prepare(
  `INSERT INTO imports (profileId, fileName, confidence, transactionCount, warnings, batchId)
   VALUES (?, ?, ?, ?, ?, ?)`,
);

const insertTransaction = db.prepare(
  `INSERT INTO transactions (bookingDate, valueDate, amountCents, currency, purpose, importFile, importBatchId)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
);

describe('admin imports API', () => {
  beforeEach(() => {
    resetTables();
  });

  it('lists recorded imports with row counts and inserted counts', async () => {
    const batchId = 'batch-list-1';
    const first = insertImport.run('commerzbank_de', 'commerzbank.csv', 0.98, 12, JSON.stringify([]), batchId);
    const firstId = Number(first.lastInsertRowid);
    insertTransaction.run('2025-01-01', '2025-01-01', -1000, 'EUR', 'A', 'commerzbank.csv', batchId);
    insertTransaction.run('2025-01-02', '2025-01-02', 2000, 'EUR', 'B', 'commerzbank.csv', batchId);

    const second = insertImport.run('n26_de', 'n26.csv', 0.95, 5, JSON.stringify([]), null);
    const secondId = Number(second.lastInsertRowid);
    insertTransaction.run('2025-02-01', '2025-02-01', -500, 'EUR', 'C', 'n26.csv', null);

    const res = await request(app).get('/api/admin/imports');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.imports)).toBe(true);

    const imports: Array<any> = res.body.imports;
    expect(imports.length).toBeGreaterThanOrEqual(2);

    const byId = new Map(imports.map(item => [item.id, item]));
    expect(byId.get(firstId)).toMatchObject({
      id: firstId,
      source: 'commerzbank_de',
      rowCount: 12,
      insertedCount: 2,
    });
    expect(byId.get(secondId)).toMatchObject({
      id: secondId,
      source: 'n26_de',
      rowCount: 5,
      insertedCount: 1,
    });
  });

  it('deletes selected imports and cascades transactions', async () => {
    const batchId = 'batch-delete-1';
    const result = insertImport.run('n26_de', 'n26.csv', 0.92, 3, JSON.stringify([]), batchId);
    const importId = Number(result.lastInsertRowid);

    insertTransaction.run('2025-09-01', '2025-09-01', -12345, 'EUR', 'Test 1', 'n26.csv', batchId);
    insertTransaction.run('2025-09-02', '2025-09-02', 67890, 'EUR', 'Test 2', 'n26.csv', batchId);

    const delRes = await request(app).delete('/api/admin/imports').send({ ids: [importId] });

    expect(delRes.status).toBe(200);
    expect(delRes.body).toMatchObject({ ok: true, deletedImports: 1, deletedTransactions: 2 });

    const remainingTx = db.prepare(`SELECT COUNT(1) AS c FROM transactions`).get() as { c: number };
    const remainingImports = db.prepare(`SELECT COUNT(1) AS c FROM imports`).get() as { c: number };

    expect(remainingTx.c).toBe(0);
    expect(remainingImports.c).toBe(0);
  });

  it('returns zero counts when deleting non-existent imports', async () => {
    const res = await request(app).delete('/api/admin/imports').send({ ids: [9999] });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, deletedImports: 0, deletedTransactions: 0 });
  });
});
