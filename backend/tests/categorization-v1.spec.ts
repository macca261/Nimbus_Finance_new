import { describe, expect, it } from 'vitest';

import { normalizeMerchant } from '../src/categorization/merchants';
import { applyRules } from '../src/categorization/rules';

describe('categorization pipeline pieces', () => {
  it('REWE → groceries', () => {
    const row = {
      rawText: 'Kartenzahlung REWE Markt 123',
      counterparty: 'REWE Markt 123',
    };

    const merchant = normalizeMerchant(row.rawText, row.counterparty);
    const hit = applyRules(merchant.merchant, row.rawText);

    expect(merchant.merchant).toBe('REWE');
    expect(hit?.category).toBe('groceries');
    expect(hit?.source).toBe('rule');
  });

  it('Uber ride → transport:rideshare', () => {
    const row = {
      rawText: 'Zahlung im Einzugsverfahren UBER BV',
      counterparty: 'Uber BV',
    };

    const merchant = normalizeMerchant(row.rawText, row.counterparty);
    const hit = applyRules(merchant.merchant, row.rawText);

    expect(hit?.category).toBe('transport:rideshare');
  });
});


