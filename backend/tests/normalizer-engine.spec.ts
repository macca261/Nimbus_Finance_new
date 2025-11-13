import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '../src/db';
import { clearRulesCache, normalize } from '../src/normalizer/engine';

const insertRule = db.prepare(
  `INSERT INTO normalization_rules (id, matcher, pattern, normalizeTo, priority, categoryHint, notes)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
);

describe('normalizer engine', () => {
  beforeEach(() => {
    db.exec('DELETE FROM normalization_rules');
    clearRulesCache();
  });

  it('applies rules in priority order and returns merchant/category hint', () => {
    insertRule.run('rule-contains', 'contains', 'uber', 'Uber (contains)', 50, 'mobilität.taxi_ridehail', null);
    insertRule.run('rule-start', 'startsWith', 'uber', 'Uber (start)', 5, 'mobilität.taxi_ridehail', null);

    const result = normalize({ text: 'Uber BV Fahrt 123', counterparty: null });
    expect(result).toMatchObject({
      merchant: 'Uber (start)',
      categoryHint: 'mobilität.taxi_ridehail',
      matchedRuleId: 'rule-start',
    });
  });

  it('supports diacritics-insensitive contains matching', () => {
    insertRule.run('rule-cafe', 'contains', 'cafe', 'Café Merchant', 25, null, null);

    const result = normalize({ text: 'Zahlung Café Central', counterparty: 'Café Central' });
    expect(result.merchant).toBe('Café Merchant');
  });

  it('skips invalid regex patterns and falls back to other rules', () => {
    insertRule.run('rule-bad', 'regex', '[unterminated', 'Bad Regex', 1, null, null);
    insertRule.run('rule-equals', 'equals', 'netflix', 'Netflix', 10, 'abos.streaming', null);

    const result = normalize({ text: 'NETFLIX*12345', counterparty: 'Netflix' });
    expect(result).toMatchObject({
      merchant: 'Netflix',
      matchedRuleId: 'rule-equals',
    });
  });

  it('returns empty result when no rules match', () => {
    insertRule.run('rule-other', 'contains', 'somethingelse', 'Other', 10, null, null);

    const result = normalize({ text: 'Comdirect Giro', counterparty: 'Comdirect' });
    expect(result).toEqual({});
  });
});


