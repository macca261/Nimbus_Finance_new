import { describe, it, expect } from 'vitest';
import { inferCategory, type NormalizedTx } from '../categorize';

const makeTx = (overrides: Partial<NormalizedTx> & { purpose?: string }): NormalizedTx => ({
  purpose: '',
  counterpartName: undefined,
  rawCode: undefined,
  ...overrides,
});

describe('inferCategory', () => {
  it('detects groceries keywords', () => {
    expect(inferCategory(makeTx({ purpose: 'Einkauf REWE MARKT 123 Berlin' }))).toBe('Groceries');
    expect(inferCategory(makeTx({ purpose: 'ALDI Süd Filiale' }))).toBe('Groceries');
  });

  it('detects transport', () => {
    expect(inferCategory(makeTx({ purpose: 'UBER *TRIP 12345' }))).toBe('Transport');
    expect(inferCategory(makeTx({ purpose: 'BVG Monatskarte' }))).toBe('Transport');
  });

  it('detects online services', () => {
    expect(inferCategory(makeTx({ purpose: 'PAYPAL *OPENAI' }))).toBe('Online Services');
    expect(inferCategory(makeTx({ purpose: 'Amazon Marketplace' }))).toBe('Online Services');
  });

  it('detects mobile and internet providers', () => {
    expect(inferCategory(makeTx({ purpose: 'Telekom Deutschland GmbH' }))).toBe('Mobile/Internet');
    expect(inferCategory(makeTx({ purpose: 'Rechnung o2 Free' }))).toBe('Mobile/Internet');
  });

  it('detects fees even when accent missing', () => {
    expect(inferCategory(makeTx({ purpose: 'Kontofuehrungsgebuehr' }))).toBe('Fees');
    expect(inferCategory(makeTx({ purpose: 'KARTENENTGELT MÄRZ' }))).toBe('Fees');
  });

  it('detects income', () => {
    expect(inferCategory(makeTx({ purpose: 'Gehalt ACME GmbH' }))).toBe('Income');
    expect(inferCategory(makeTx({ purpose: 'Monatliche Lohnzahlung' }))).toBe('Income');
  });

  it('falls back to Other when no rule matches', () => {
    expect(inferCategory(makeTx({ purpose: 'Spontanüberweisung an Freund' }))).toBe('Other');
  });
});


