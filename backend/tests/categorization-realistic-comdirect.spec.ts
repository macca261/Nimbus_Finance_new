import { describe, expect, it } from 'vitest';
import type { ParsedRow } from '../src/parser/types';
import { categorizeTransaction } from '../src/categorization';

describe('categorization with realistic comdirect data', () => {
  const baseRow: ParsedRow = {
    bookingDate: '2025-01-15',
    valutaDate: '2025-01-15',
    amountCents: -2599,
    currency: 'EUR',
    direction: 'out',
    accountId: 'comdirect:giro',
    accountIban: 'DE89370400440532013000',
    counterparty: null,
    counterpartyIban: null,
    mcc: null,
    reference: null,
    rawText: '',
    raw: {},
  };

  it('categorizes Lidl transaction correctly', () => {
    // Real comdirect format: "Lidl sagt Danke ..." or "LIDL SAGT DANKE ..."
    const tx = categorizeTransaction({
      ...baseRow,
      rawText: 'Lidl sagt Danke 12345 Berlin',
      counterparty: 'LIDL',
    });

    expect(tx.category).not.toBe('other');
    expect(tx.category).toBe('groceries');
    expect(tx.categorySource).toBe('rule');
    expect(tx.categoryConfidence).toBeGreaterThan(0.8);
  });

  it('categorizes REWE transaction correctly', () => {
    const tx = categorizeTransaction({
      ...baseRow,
      rawText: 'Kartenzahlung REWE Markt 123 Berlin',
      counterparty: 'REWE',
    });

    expect(tx.category).not.toBe('other');
    expect(tx.category).toBe('groceries');
    expect(tx.categorySource).toBe('rule');
    expect(tx.categoryConfidence).toBeGreaterThan(0.8);
  });

  it('categorizes Uber Eats transaction correctly', () => {
    const tx = categorizeTransaction({
      ...baseRow,
      rawText: 'UBER EATS ORDER 12345',
      counterparty: 'UBER EATS',
    });

    expect(tx.category).not.toBe('other');
    // Should match transport:rideshare or dining:delivery
    expect(['transport:rideshare', 'dining:delivery']).toContain(tx.category);
    expect(tx.categorySource).toBe('rule');
    expect(tx.categoryConfidence).toBeGreaterThan(0.8);
  });

  it('categorizes salary income correctly', () => {
    const tx = categorizeTransaction({
      ...baseRow,
      direction: 'in',
      amountCents: 350000,
      rawText: 'Gehalt Firma Beispiel GmbH',
    });

    expect(tx.category).not.toBe('other');
    expect(tx.category).toBe('income:salary');
    expect(tx.categorySource).toBe('rule');
    expect(tx.categoryConfidence).toBeGreaterThanOrEqual(0.9);
  });

  it('categorizes rent payment correctly', () => {
    const tx = categorizeTransaction({
      ...baseRow,
      rawText: 'Miete Januar 2025',
      counterparty: 'Vermieter GmbH',
    });

    expect(tx.category).not.toBe('other');
    expect(tx.category).toBe('housing:rent');
    expect(tx.categorySource).toBe('rule');
    expect(tx.categoryConfidence).toBeGreaterThan(0.8);
  });

  it('categorizes Deutsche Bahn transaction correctly', () => {
    const tx = categorizeTransaction({
      ...baseRow,
      rawText: 'SEPA Lastschrift DEUTSCHE BAHN AG Ticket 12345',
    });

    expect(tx.category).not.toBe('other');
    expect(tx.category).toBe('transport:public');
    expect(tx.categorySource).toBe('rule');
    expect(tx.categoryConfidence).toBeGreaterThan(0.8);
  });
});

