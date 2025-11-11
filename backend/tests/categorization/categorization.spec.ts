import { describe, expect, it } from 'vitest';

import type { ParsedRow } from '../../src/parser/types';
import { categorizeTransaction } from '../../src/categorization';
import type { CategoryRule } from '../../src/categorization/types';

const baseRow: ParsedRow = {
  bookingDate: '2025-01-01',
  valutaDate: '2025-01-01',
  amountCents: -1299,
  currency: 'EUR',
  direction: 'out',
  accountId: 'test:account',
  accountIban: null,
  counterparty: null,
  counterpartyIban: null,
  mcc: null,
  reference: null,
  rawText: '',
  raw: {},
};

describe('categorization engine (rules-first)', () => {
  it('assigns groceries category for known supermarket merchants', () => {
    const tx = categorizeTransaction({
      ...baseRow,
      rawText: 'Kartenzahlung REWE Markt 123 Berlin',
    });

    expect(tx.category).toBe('groceries');
    expect(tx.merchant).toBe('REWE');
    expect(tx.categorySource).toBe('rule');
    expect(tx.categoryConfidence).toBeGreaterThanOrEqual(0.9);
  });

  it('categorizes streaming subscriptions using keyword rules', () => {
    const tx = categorizeTransaction({
      ...baseRow,
      rawText: 'Lastschrift NETFLIX.COM NL',
    });

    expect(tx.category).toBe('subscriptions:streaming');
    expect(tx.categorySource).toBe('rule');
  });

  it('categorizes Deutsche Bahn transactions as public transport', () => {
    const tx = categorizeTransaction({
      ...baseRow,
      rawText: 'SEPA Lastschrift DEUTSCHE BAHN AG Ticket 12345',
    });

    expect(tx.category).toBe('transport:public');
  });

  it('detects Uber trips via merchant pattern', () => {
    const tx = categorizeTransaction({
      ...baseRow,
      rawText: 'PAYPAL *UBER TRIP 8765',
    });

    expect(tx.category).toBe('transport:rideshare');
    expect(tx.merchant).toBe('UBER');
  });

  it('recognizes salary inflows with high confidence', () => {
    const tx = categorizeTransaction({
      ...baseRow,
      direction: 'in',
      amountCents: 250000,
      rawText: 'Gehalt Firma Beispiel GmbH',
    });

    expect(tx.category).toBe('income:salary');
    expect(tx.categorySource).toBe('rule');
    expect(tx.categoryConfidence).toBe(1);
  });

  it('assigns bank fees category for fee keywords', () => {
    const tx = categorizeTransaction({
      ...baseRow,
      rawText: 'KONTOführungsgebühr Monatsabschluss',
    });

    expect(tx.category).toBe('fees:bank');
  });

  it('classifies internal transfers based on explicit keywords', () => {
    const tx = categorizeTransaction({
      ...baseRow,
      rawText: 'Eigene Übertragung Sparkonto',
    });

    expect(tx.category).toBe('internal:own-account');
  });

  it('falls back to other with unknown source when nothing matches', () => {
    const tx = categorizeTransaction({
      ...baseRow,
      rawText: 'Unbekannte Zahlung ohne Kontext',
    });

    expect(tx.category).toBe('other');
    expect(tx.categorySource).toBe('unknown');
    expect(tx.categoryConfidence).toBeCloseTo(0.1);
  });

  it('allows user rules to override system categorization', () => {
    const userRule: CategoryRule = {
      id: 'user_custom_travel',
      enabled: true,
      source: 'user',
      score: 500,
      when: { contains: ['REWE'] },
      setCategory: 'transport:public',
    };

    const tx = categorizeTransaction(
      {
        ...baseRow,
        rawText: 'Kartenzahlung REWE Markt 123 Berlin',
      },
      { userRules: [userRule] },
    );

    expect(tx.category).toBe('transport:public');
    expect(tx.categorySource).toBe('user');
  });
});


