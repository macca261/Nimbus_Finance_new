import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server';
import type { Database } from '../../src/db';
import { openDb, ensureSchema, insertTransactions, type CanonicalRow } from '../../src/db';
import { categorizeTransaction, mapNimbusCategoryToLegacy } from '../../src/categorization';
import type { ParsedRow } from '../../src/parsing/types';

describe('Debug API – single transaction categorization view', () => {
  let app: any;
  let db: Database;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.TEST_DB = '1';
    db = openDb();
    ensureSchema(db);
    app = createApp({ db } as any);
  });

  it('returns raw, normalized and engine categorization details for a transaction', async () => {
    const row: CanonicalRow = {
      bookingDate: '2025-01-15',
      valueDate: '2025-01-15',
      amountCents: -4500,
      currency: 'EUR',
      purpose: 'REWE MARKT 123 KOELN',
      counterpartName: 'REWE MARKT',
      accountIban: 'DE001',
      direction: 'out',
      accountId: 'acc-1',
      source: 'csv_bank',
      sourceProfile: 'comdirect',
    };

    const { inserted } = insertTransactions([row], db);
    expect(inserted).toBe(1);

    const stored = db
      .prepare(
        `SELECT id, bookingDate, amountCents, currency, purpose, counterpartName, accountIban, category
         FROM transactions
         ORDER BY id DESC
         LIMIT 1`,
      )
      .get() as { id: number; bookingDate: string; amountCents: number; currency: string; purpose: string; counterpartName: string | null; accountIban: string | null; category: string | null };

    expect(stored).toBeDefined();

    // Build ParsedRow similar to how the engine sees it
    const parsed: ParsedRow = {
      bookingDate: stored.bookingDate,
      valutaDate: stored.bookingDate,
      amountCents: stored.amountCents,
      currency: stored.currency,
      direction: stored.amountCents >= 0 ? 'in' : 'out',
      accountId: 'acc-1',
      accountIban: stored.accountIban,
      counterparty: stored.counterpartName,
      counterpartyIban: null,
      mcc: null,
      reference: null,
      rawText: `${stored.purpose}`,
      raw: {},
      normalizedText: undefined,
      category: undefined,
      categoryConfidence: undefined,
      categorySource: undefined,
      categorySystem: undefined,
    };

    const engineResult = categorizeTransaction(parsed);
    const legacyCategory = mapNimbusCategoryToLegacy(engineResult.category);

    const res = await request(app).get(`/api/debug/transaction/${stored.id}`).expect(200);

    const body = res.body;
    expect(body).toBeDefined();
    expect(body.raw).toBeDefined();
    expect(body.normalized).toBeDefined();
    expect(body.engine).toBeDefined();

    // Category and source should match current engine behaviour (after mapping)
    expect(body.engine.nimbusCategory).toBe(engineResult.category);
    expect(body.engine.categoryId).toBe(legacyCategory);

    // Flags should be present and boolean
    expect(typeof body.raw.isRefund).toBe('boolean');
    expect(typeof body.raw.isInternalTransfer).toBe('boolean');
    expect(typeof body.raw.isPassThrough).toBe('boolean');
    expect(typeof body.raw.isReimbursement).toBe('boolean');

    // Explanation fields should be attached on normalized
    expect(body.normalized.categorizationReasonCode).toBeDefined();
    expect(body.normalized.categorizationReasonText).toBeDefined();
  });

  it('returns 404 for unknown transaction id', async () => {
    const res = await request(app).get('/api/debug/transaction/999999').expect(404);
    expect(res.body).toEqual({ error: 'not_found' });
  });
});


