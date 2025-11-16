import { describe, expect, it } from 'vitest';
import { fuzzyMatchMerchant } from '../../src/categorizers/fuzzyMatcher';

describe('fuzzy merchant matching', () => {
  it('matches LIDl (typo) to LIDL groceries category', () => {
    const result = fuzzyMatchMerchant('LIDl sagt danke hamburg');
    
    expect(result).not.toBeNull();
    expect(result!.canonicalName.toLowerCase()).toContain('lidl');
    expect(result!.category).toBe('groceries');
    expect(result!.score).toBeGreaterThanOrEqual(0.80);
    expect(result!.merchantId).toBe('merchant_lidl');
  });

  it('matches REWE Markt GmbH Köln to REWE groceries', () => {
    const result = fuzzyMatchMerchant('Rewe Markt GmbH Köln');
    
    expect(result).not.toBeNull();
    expect(result!.category).toBe('groceries');
    expect(result!.canonicalName).toBe('REWE');
    expect(result!.score).toBeGreaterThanOrEqual(0.80);
  });

  it('matches ALDI SÜD Bochum to ALDI groceries', () => {
    const result = fuzzyMatchMerchant('ALDI SÜD Bochum');
    
    expect(result).not.toBeNull();
    expect(result!.category).toBe('groceries');
    expect(result!.canonicalName).toBe('ALDI');
    expect(result!.score).toBeGreaterThanOrEqual(0.75);
  });

  it('matches AMAZON EU S.A R.L to AMAZON shopping', () => {
    const result = fuzzyMatchMerchant('AMAZON EU S.A R.L');
    
    expect(result).not.toBeNull();
    expect(result!.category).toBe('shopping');
    expect(result!.canonicalName).toBe('AMAZON');
    expect(result!.score).toBeGreaterThanOrEqual(0.80);
  });

  it('matches DM DROGERIE MARKT to DM shopping', () => {
    const result = fuzzyMatchMerchant('DM DROGERIE MARKT');
    
    expect(result).not.toBeNull();
    expect(result!.category).toBe('shopping');
    expect(result!.canonicalName).toBe('DM');
    expect(result!.score).toBeGreaterThanOrEqual(0.80);
    expect(result!.merchantId).toBe('merchant_dm');
    expect(result!.source).toBe('merchant-db');
  });

  it('does not match completely unrelated merchant below threshold', () => {
    const result = fuzzyMatchMerchant('XYZ Unrelated Shop');
    
    expect(result).toBeNull();
  });

  it('does not match very short input', () => {
    const result = fuzzyMatchMerchant('AB');
    
    expect(result).toBeNull();
  });

  it('handles empty input gracefully', () => {
    const result = fuzzyMatchMerchant('');
    
    expect(result).toBeNull();
  });

  it('matches Deutsche Bahn variants', () => {
    const result1 = fuzzyMatchMerchant('Deutsche Bahn');
    expect(result1).not.toBeNull();
    expect(result1!.category).toBe('transport');
    expect(result1!.canonicalName).toBe('DB');
    expect(result1!.merchantId).toBe('merchant_deutsche_bahn');
    expect(result1!.score).toBeGreaterThanOrEqual(0.80);
    
    const result2 = fuzzyMatchMerchant('DB FERNVERKEHR');
    expect(result2).not.toBeNull();
    expect(result2!.category).toBe('transport');
    expect(result2!.canonicalName).toBe('DB');
    expect(result2!.merchantId).toBe('merchant_deutsche_bahn');
    expect(result2!.score).toBeGreaterThanOrEqual(0.80);
  });

  it('matches DRILLISCH ONLINE GMBH & CO. KG to subscriptions:telecom', () => {
    const result = fuzzyMatchMerchant('DRILLISCH ONLINE GMBH & CO. KG');
    
    expect(result).not.toBeNull();
    expect(result!.category).toBe('subscriptions');
    expect(result!.canonicalName).toBe('DRILLISCH');
    expect(result!.score).toBeGreaterThanOrEqual(0.80);
  });
});

