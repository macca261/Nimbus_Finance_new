import { describe, it, beforeEach, expect, vi } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import crypto from 'node:crypto';
import { openDb, ensureSchema, insertTransactions, type CanonicalRow } from '../../db';
import importsRouter from '../imports';

vi.mock('../../services/transactionCategorizationEngine', () => ({
  categorizeTransaction: () => null,
  detectSavings: () => null,
}));

describe('Imports API', () => {
  let db: ReturnType<typeof openDb>;
  let app: express.Application;

  beforeEach(() => {
    db = openDb();
    ensureSchema(db);
    app = express();
    app.use(express.json());
    (app as any).locals.db = db;
    app.use('/api/imports', importsRouter);
  });

  function seedImport(rowCount = 2) {
    const fileHash = crypto.createHash('sha256').update(`seed-${Date.now()}-${Math.random()}`).digest('hex');
    const insertImport = db.prepare(`
      INSERT INTO imports (profileId, fileName, confidence, transactionCount, warnings, batchId, fileHash, status, rowCount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = insertImport.run('csv', 'import-seed.csv', 1, 0, '[]', null, fileHash, 'processing', 0);
    const importId = Number(result.lastInsertRowid);

    const rows: CanonicalRow[] = [];
    for (let i = 0; i < rowCount; i += 1) {
      rows.push({
        id: `tx-${importId}-${i}`,
        bookingDate: '2025-01-01',
        valueDate: '2025-01-01',
        amountCents: 1000 + i,
        currency: 'EUR',
        purpose: `Test ${i}`,
        importId,
      });
    }
    insertTransactions(rows, db);
    db.prepare(`UPDATE imports SET transactionCount = ?, rowCount = ?, status = 'complete' WHERE id = ?`).run(
      rowCount,
      rowCount,
      importId,
    );
    return importId;
  }

  it('lists imports via GET /api/imports', async () => {
    seedImport();
    const res = await supertest(app).get('/api/imports');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.imports)).toBe(true);
    expect(res.body.imports[0]).toMatchObject({ filename: 'import-seed.csv', rowCount: 2 });
  });

  it('deletes an import and cascades transactions', async () => {
    const importId = seedImport();
    const res = await supertest(app).delete(`/api/imports/${importId}`);
    expect(res.status).toBe(204);

    const remainingImports = db.prepare('SELECT COUNT(1) AS cnt FROM imports').get() as { cnt: number };
    expect(remainingImports.cnt).toBe(0);

    const remainingTx = db.prepare('SELECT COUNT(1) AS cnt FROM transactions').get() as { cnt: number };
    expect(remainingTx.cnt).toBe(0);
  });

  it('returns 404 when deleting unknown import', async () => {
    const res = await supertest(app).delete('/api/imports/999');
    expect(res.status).toBe(404);
  });
});
