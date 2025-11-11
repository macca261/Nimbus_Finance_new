import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { makeTestApp, resetDb } from './helpers/test-utils';
import { insertTransactions, recordImport, type CanonicalRow } from '../src/db';

describe('/api/dashboard', () => {
  let app: any;
  let db: any;

  beforeEach(() => {
    const made = makeTestApp();
    app = made.app;
    db = made.db;
    resetDb(db);
  });

  it('returns summary with KPIs and charts', async () => {
    const rows: CanonicalRow[] = [
      {
        bookingDate: '2025-03-01',
        valueDate: '2025-03-01',
        amountCents: 300000,
        currency: 'EUR',
        purpose: 'Gehalt ACME GmbH',
        counterpartName: 'ACME GmbH',
      },
      {
        bookingDate: '2025-03-02',
        valueDate: '2025-03-02',
        amountCents: -4500,
        currency: 'EUR',
        purpose: 'REWE Markt 123 Berlin',
        counterpartName: 'REWE',
      },
      {
        bookingDate: '2025-03-05',
        valueDate: '2025-03-05',
        amountCents: -1599,
        currency: 'EUR',
        purpose: 'NETFLIX.COM Amsterdam',
        counterpartName: 'Netflix',
      },
      {
        bookingDate: '2025-03-10',
        valueDate: '2025-03-10',
        amountCents: -990,
        currency: 'EUR',
        purpose: 'Kartenentgelt März',
      },
    ];

    insertTransactions(rows, db);
    recordImport(
      {
        profileId: 'comdirect',
        fileName: 'comdirect_test.csv',
        confidence: 0.98,
        transactionCount: rows.length,
        warnings: [],
      },
      db,
    );

    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('kpis');
    expect(res.body.kpis.currentBalance).toBeGreaterThan(0);
    expect(res.body.kpis.income30d).toBeGreaterThan(0);
    expect(Array.isArray(res.body.spendingByCategory)).toBe(true);
    expect(res.body.spendingByCategory.some((item: any) => item.category === 'groceries')).toBe(true);
    expect(Array.isArray(res.body.balanceOverTime)).toBe(true);
    expect(Array.isArray(res.body.cashflowByMonth)).toBe(true);
    expect(Array.isArray(res.body.subscriptions)).toBe(true);
    expect(Array.isArray(res.body.topCategories)).toBe(true);
    expect(Array.isArray(res.body.potentialTaxRelevant)).toBe(true);
    expect(Array.isArray(res.body.achievements)).toBe(true);
    expect(Array.isArray(res.body.recentTransactions)).toBe(true);
    expect(typeof res.body.transactionCount).toBe('number');
    expect(typeof res.body.uncategorizedCount).toBe('number');
  });
});


