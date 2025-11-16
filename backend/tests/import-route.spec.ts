import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';

import { createApp } from '../src/server';
import { db } from '../src/db';

const app = createApp({ db });

const fx = (...p: string[]) => path.join(__dirname, 'fixtures', ...p);

describe('/api/import error handling', () => {
  beforeEach(() => {
    db.exec('DELETE FROM transfer_links');
    db.exec('DELETE FROM transactions');
    db.exec('DELETE FROM imports');
  });

  it('returns 400 BAD_REQUEST when no file is uploaded', async () => {
    const res = await request(app)
      .post('/api/import')
      .send();

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      code: 'BAD_REQUEST',
      message: 'No file uploaded',
    });
  });

  it('returns 400 BAD_REQUEST when file field name is wrong', async () => {
    const csvContent = 'Date,Amount\n2025-01-01,100.00';
    const res = await request(app)
      .post('/api/import')
      .attach('wrongField', Buffer.from(csvContent), 'test.csv');

    // Multer doesn't set req.file when field name is wrong, so we get "no file" error
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      code: 'BAD_REQUEST',
      message: 'No file uploaded',
    });
  });

  it('returns 400 BANK_PARSE_ERROR for garbled CSV', async () => {
    const garbled = 'This is not a CSV file at all\nJust random text';
    const res = await request(app)
      .post('/api/import')
      .attach('file', Buffer.from(garbled), 'garbled.csv');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BANK_PARSE_ERROR');
    expect(res.body.message).toBeTruthy();
  });

  it('returns 400 IMPORT_EMPTY when all rows are duplicates', async () => {
    // First import - should succeed
    const paypalFixture = fx('paypal_min.csv');
    if (!fs.existsSync(paypalFixture)) {
      console.warn('[import-route] paypal_min.csv not found, skipping duplicate test');
      return;
    }

    const firstRes = await request(app)
      .post('/api/import')
      .attach('file', paypalFixture);

    expect(firstRes.status).toBe(200);
    expect(firstRes.body.insertedCount).toBeGreaterThan(0);

    // Second import - should return IMPORT_EMPTY
    const secondRes = await request(app)
      .post('/api/import')
      .attach('file', paypalFixture);

    expect(secondRes.status).toBe(400);
    expect(secondRes.body).toMatchObject({
      code: 'IMPORT_EMPTY',
    });
    expect(Array.isArray(secondRes.body.reasons)).toBe(true);
    expect(secondRes.body.reasons.some((r: string) => r.toLowerCase().includes('duplicate'))).toBe(true);
  });

  it('returns 500 IMPORT_FAILED for unexpected DB errors', async () => {
    // Mock a DB error by closing the connection
    const originalPrepare = db.prepare;
    vi.spyOn(db, 'prepare').mockImplementationOnce(() => {
      throw new Error('Simulated DB error');
    });

    const csvContent = 'Buchungstag,Betrag\n01.01.2025,100.00';
    const res = await request(app)
      .post('/api/import')
      .attach('file', Buffer.from(csvContent), 'test.csv');

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      code: 'IMPORT_FAILED',
      message: 'Unbekannter Importfehler',
    });

    vi.restoreAllMocks();
  });

  it('validates file field name is exactly "file"', async () => {
    const csvContent = 'Date,Amount\n2025-01-01,100.00';
    const res = await request(app)
      .post('/api/import')
      .attach('file', Buffer.from(csvContent), 'test.csv');

    // Should not fail on field name validation (BAD_REQUEST)
    // (will likely fail on parsing, but that's expected)
    expect(res.body.code).not.toBe('BAD_REQUEST');
    // Should either succeed or fail with a parse error, not a field name error
    if (res.status === 400) {
      expect(['BANK_PARSE_ERROR', 'IMPORT_EMPTY', 'PAYPAL_PARSE_ERROR']).toContain(res.body.code);
    }
  });
});

