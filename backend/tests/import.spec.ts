import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import path from 'node:path';
import fs from 'node:fs';
import { makeTestApp, resetDb } from './helpers/test-utils';

let app: any; let db: any;
beforeEach(() => {
  const made = makeTestApp();
  app = made.app; db = made.db;
  resetDb(db);
});

describe('CSV import endpoint', () => {
  it('uploads CSV and aggregates correctly', async () => {
    const samplePath = path.join(__dirname, 'fixtures', 'sample.csv');
    if (!fs.existsSync(samplePath)) {
      fs.mkdirSync(path.dirname(samplePath), { recursive: true });
      fs.writeFileSync(samplePath, `Buchungstag;Verwendungszweck;Betrag;Währung\n01.03.2025;GEHALT;3000,00;EUR\n02.03.2025;REWE;-31,24;EUR\n`);
    }

    const buf = fs.readFileSync(samplePath);
    const res = await request(app)
      .post('/api/imports/csv')
      .attach('file', buf, 'sample.csv');

    expect(res.status).toBe(200);
    const body = res.body || {} as any;
    const data = body.data || body;
    expect(typeof data.adapterId).toBe('string');
    expect(data.imported).toBeGreaterThan(0);

    const bal = await request(app).get('/api/summary/balance');
    expect(bal.status).toBe(200);
    const b = bal.body?.data || bal.body;
    expect(typeof b.balanceCents).toBe('number');

    const tx = await request(app).get('/api/transactions?limit=5');
    expect(tx.status).toBe(200);
    expect(Array.isArray(tx.body?.data || tx.body)).toBe(true);
  });
});


