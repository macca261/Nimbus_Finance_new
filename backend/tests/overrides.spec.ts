import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { makeTestApp, resetDb } from './helpers/test-utils';
import { insertTransactions } from '../src/db';

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
      .post('/api/overrides')
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
