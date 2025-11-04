import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { makeTestApp, resetDb } from './helpers/test-utils';

let app: any;
let db: any;

beforeEach(() => {
  const made = makeTestApp();
  app = made.app;
  db = made.db;
  resetDb(db);
});

describe('CSV export endpoint', () => {
  it('returns header and rows', async () => {
    const insert = db.prepare(`
      INSERT INTO transactions (bookingDate, valueDate, amountCents, currency, purpose)
      VALUES (?,?,?,?,?)
    `);
    insert.run('2025-01-01', '2025-01-01', 10000, 'EUR', 'Test Income');
    insert.run('2025-01-02', '2025-01-02', -2500, 'EUR', 'Test Expense');

    const res = await request(app).get('/api/transactions.csv?limit=10');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('transactions.csv');

    const lines = res.text.trim().split(/\r?\n/);
    expect(lines[0]).toBe('id,bookingDate,valueDate,amountCents,currency,purpose,counterpartName,accountIban,rawCode,createdAt');
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines.some(line => line.includes('Test Income'))).toBe(true);
    expect(lines.some(line => line.includes('Test Expense'))).toBe(true);
  });
});


