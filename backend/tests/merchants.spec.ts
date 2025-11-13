import { describe, expect, it } from 'vitest';

import { normalizeMerchant } from '../src/categorization/merchants';

describe('merchant normaliser', () => {
  it('detects Uber', () => {
    const info = normalizeMerchant('Zahlung im Einzugsverfahren UBER BV', 'Uber BV');
    expect(info.merchant).toBe('UBER');
  });

  it('detects REWE from counterparty', () => {
    const info = normalizeMerchant('Kartenzahlung', 'REWE Markt 123');
    expect(info.merchant).toBe('REWE');
  });

  it('falls back to uppercase counterparty', () => {
    const info = normalizeMerchant('Kartenzahlung', 'Acme GmbH');
    expect(info.merchant).toBe('ACME GMBH');
  });
});


