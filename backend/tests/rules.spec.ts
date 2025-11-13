import { describe, expect, it } from 'vitest';

import { applyRules } from '../src/categorization/rules';

describe('rule engine v1', () => {
  it('maps REWE to supermarket', () => {
    const hit = applyRules('REWE', 'Kartenzahlung REWE Markt 123');
    expect(hit?.category).toBe('groceries');
    expect(hit?.source).toBe('rule');
  });

  it('maps Uber to ride-hail', () => {
    const hit = applyRules('UBER', 'Zahlung im Einzugsverfahren UBER BV');
    expect(hit?.category).toBe('transport:rideshare');
  });

  it('fallback: no match returns null', () => {
    const hit = applyRules('ACME', 'Some unknown thing');
    expect(hit).toBeNull();
  });
});


