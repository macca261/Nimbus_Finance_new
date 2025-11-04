import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import path from 'node:path';
import fs from 'node:fs';
import iconv from 'iconv-lite';
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

  it('decodes cp1252 encoded CSV with umlauts and quotes', async () => {
    const sample = `Buchungstag;Verwendungszweck;Betrag;Währung\n01.03.2025;"Frühstück äöüß";-12,34;EUR\n02.03.2025;"Miete ""Altbau""";-900,00;EUR\n`;
    const buf = iconv.encode(sample, 'win1252');

    const res = await request(app)
      .post('/api/imports/csv')
      .attach('file', buf, 'cp1252-sample.csv');

    expect(res.status).toBe(200);
    const body = res.body || {} as any;
    const data = body.data || body;
    expect(data.imported).toBeGreaterThan(0);

    const list = await request(app).get('/api/transactions?limit=5');
    expect(list.status).toBe(200);
    const rows = list.body?.data || list.body || [];
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.some((r: any) => typeof r?.purpose === 'string' && r.purpose.includes('äöüß'))).toBe(true);
  });
});


