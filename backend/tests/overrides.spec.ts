import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { makeTestApp, resetDb } from './helpers/test-utils';
import { insertTransactions } from '../src/db';
import {
  clearOverride,
  ensureOverridesTable,
  getOverride,
  setOverride,
} from '../src/categorization/overrides';

describe('override rules', () => {
  beforeEach(() => {
    resetDb();
  });

  it('creates override rule and applies to existing transactions', async () => {
    const { app, db } = makeTestApp();

    insertTransactions(
      [
        {
          publicId: 'tx-override-1',
          bookingDate: '2025-01-01',
          valueDate: '2025-01-01',
          amountCents: -420,
          currency: 'EUR',
          purpose: 'Baeckerei Heinemann Filiale',
          counterpartName: 'Baeckerei Heinemann',
          source: 'csv_bank',
          sourceProfile: 'test_bank',
          accountId: 'bank:test',
          payee: 'Baeckerei Heinemann',
          memo: 'Baeckerei Heinemann Einkauf',
          category: 'other_review',
        },
      ],
      db,
    );

    const response = await request(app)
      .post('/api/overrides/rules')
      .send({ txId: 'tx-override-1', categoryId: 'dining_out', scope: 'payee', applyToPast: true })
      .expect(201);

    expect(response.body?.rule?.categoryId).toBe('dining_out');

    const updated = db
      .prepare('SELECT category, category_rule_id FROM transactions WHERE publicId = ?')
      .get('tx-override-1') as { category: string; category_rule_id: string };

    expect(updated.category).toBe('dining_out');
    expect(updated.category_rule_id).toContain('user_override:');
  });
});

describe('user_overrides store', () => {
  it('sets, reads, updates, clears', async () => {
    await ensureOverridesTable();
    const id = 'txn_abc123';
    expect(await getOverride(id)).toBeNull();
    await setOverride(id, 'mobilität.taxi_ridehail');
    let override = await getOverride(id);
    expect(override?.category).toBe('mobilität.taxi_ridehail');
    expect(override?.source).toBe('user');

    await setOverride(id, 'lebensmittel.supermarkt');
    override = await getOverride(id);
    expect(override?.category).toBe('lebensmittel.supermarkt');

    await clearOverride(id);
    expect(await getOverride(id)).toBeNull();
  });
});
