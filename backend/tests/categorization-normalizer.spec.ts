import fs from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '../src/db';
import { parsePayPalCsv } from '../src/parsing/paypal';
import { categorizeBatch } from '../src/categorization';
import { clearRulesCache } from '../src/normalizer/engine';

const fx = (...segments: string[]) => path.join(__dirname, 'fixtures', ...segments);

const insertRule = db.prepare(
  `INSERT INTO normalization_rules (id, matcher, pattern, normalizeTo, priority, categoryHint)
   VALUES (?, ?, ?, ?, ?, ?)`,
);

describe('categorization normalizer integration', () => {
  beforeEach(() => {
    db.exec('DELETE FROM normalization_rules');
    clearRulesCache();
  });

  it('enriches merchant/category hint without altering existing categories', () => {
    const buffer = fs.readFileSync(fx('paypal_min.csv'));
    const parsedBaseline = parsePayPalCsv(buffer);
    const baselineCategorized = categorizeBatch(parsedBaseline.rows);

    const baselineCategories = new Map<string, string | undefined>();
    const baselineMerchants = new Map<string, string | undefined>();

    for (const row of baselineCategorized) {
      const externalId = typeof row.raw?.externalId === 'string' ? row.raw.externalId : undefined;
      if (!externalId) continue;
      baselineCategories.set(externalId, row.category as string | undefined);
      baselineMerchants.set(externalId, row.merchant);
    }

    insertRule.run(
      'rule-uber',
      'regex',
      'Uber\\s?BV|Uber',
      'Uber',
      10,
      'mobilität.taxi_ridehail',
    );
    clearRulesCache();

    const parsedWithRule = parsePayPalCsv(buffer);
    const enriched = categorizeBatch(parsedWithRule.rows);

    const target = enriched.find(row => row.merchant === 'Uber');
    expect(target).toBeDefined();
    if (!target) throw new Error('Expected Uber transaction to be present');

    const externalId = typeof target.raw?.externalId === 'string' ? target.raw.externalId : undefined;
    expect(externalId).toBeDefined();
    if (!externalId) throw new Error('Expected externalId for Uber transaction');

    expect(target.categoryHint).toBe('mobilität.taxi_ridehail');
    expect((target.raw as Record<string, unknown>).normalizerMatchedRuleId).toBe('rule-uber');

    const baselineCategory = baselineCategories.get(externalId);
    expect(target.category).toBe(baselineCategory);

    const baselineMerchant = baselineMerchants.get(externalId);
    if (baselineMerchant) {
      expect(target.merchant).not.toBe(baselineMerchant);
    }
  });
});


