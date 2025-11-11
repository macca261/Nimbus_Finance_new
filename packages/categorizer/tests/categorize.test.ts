import { describe, it, expect } from 'vitest';
import { categorize } from '../src/index.js';
import type { ParsedTransaction } from '@nimbus/parsers-de/dist/types.js';

describe('categorizer', () => {
  const sampleTransactions: ParsedTransaction[] = [
    {
      bank: 'comdirect',
      bookingDate: '2025-03-01',
      amount: '3000.00',
      currency: 'EUR',
      description: 'GEHALT ACME GMBH',
      raw: {},
    },
    {
      bank: 'sparkasse',
      bookingDate: '2025-03-02',
      amount: '-31.24',
      currency: 'EUR',
      description: 'REWE MARKT 123 BERLIN',
      counterparty: 'REWE',
      raw: {},
    },
    {
      bank: 'deutsche-bank',
      bookingDate: '2025-03-03',
      amount: '-12.99',
      currency: 'EUR',
      description: 'NETFLIX ABO',
      raw: {},
    },
    {
      bank: 'comdirect',
      bookingDate: '2025-03-04',
      amount: '-45.00',
      currency: 'EUR',
      description: 'DEUTSCHE BAHN TICKET',
      raw: {},
    },
    {
      bank: 'sparkasse',
      bookingDate: '2025-03-05',
      amount: '-1200.00',
      currency: 'EUR',
      description: 'MIETE MÄRZ',
      counterparty: 'HAUSVERWALTUNG',
      raw: {},
    },
    {
      bank: 'comdirect',
      bookingDate: '2025-03-06',
      amount: '-50.00',
      currency: 'EUR',
      description: 'UNKNOWN MERCHANT XYZ',
      raw: {},
    },
  ];

  it('categorizes income correctly', () => {
    const result = categorize([sampleTransactions[0]]);
    expect(result[0].category).toBe('Income');
    expect(result[0].source).toBe('rule');
    expect(result[0].confidence).toBeGreaterThan(0.9);
  });

  it('categorizes groceries correctly', () => {
    const result = categorize([sampleTransactions[1]]);
    expect(result[0].category).toBe('Groceries');
    expect(result[0].source).toBe('rule');
  });

  it('categorizes subscriptions correctly', () => {
    const result = categorize([sampleTransactions[2]]);
    expect(result[0].category).toBe('Subscriptions');
    expect(result[0].source).toBe('rule');
  });

  it('categorizes transport correctly', () => {
    const result = categorize([sampleTransactions[3]]);
    expect(result[0].category).toBe('Transport');
    expect(result[0].source).toBe('rule');
  });

  it('categorizes housing correctly', () => {
    const result = categorize([sampleTransactions[4]]);
    expect(result[0].category).toBe('Housing');
    expect(result[0].source).toBe('rule');
  });

  it('falls back to Other for unknown transactions', () => {
    const result = categorize([sampleTransactions[5]]);
    expect(result[0].category).toBe('Other');
    expect(result[0].source).toBe('ml');
    expect(result[0].confidence).toBe(0.5);
  });

  it('categorizes all transactions', () => {
    const result = categorize(sampleTransactions);
    expect(result.length).toBe(sampleTransactions.length);
    result.forEach((tx) => {
      expect(tx.category).toBeDefined();
      expect(tx.confidence).toBeGreaterThanOrEqual(0);
      expect(tx.confidence).toBeLessThanOrEqual(1);
      expect(['rule', 'ml']).toContain(tx.source);
    });
  });
});

