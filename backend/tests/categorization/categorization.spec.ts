import { describe, expect, it } from 'vitest';

import type { ParsedRow } from '../../src/parser/types';
import { categorizeTransaction, categorize } from '../../src/categorization';
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

describe('categorization integration (full pipeline)', () => {
  it('categorizes a LIDL supermarket transaction as groceries, not Sonstiges', () => {
    const row: ParsedRow = {
      bookingDate: '2025-01-15',
      valutaDate: '2025-01-15',
      amountCents: -2345,
      currency: 'EUR',
      direction: 'out',
      accountId: 'test:account',
      accountIban: null,
      counterparty: 'LIDL SAGT DANKE',
      counterpartyIban: null,
      mcc: null,
      reference: null,
      rawText: 'LIDL SAGT DANKE. 12345678 HAMBURG//Hamburg/DE',
      raw: {},
    };

    const result = categorize({
      text: row.rawText ?? '',
      amount: row.amountCents / 100,
      amountCents: row.amountCents,
      iban: row.accountIban ?? null,
      counterpart: row.counterparty ?? null,
      payee: row.counterparty ?? null,
      memo: row.rawText,
      source: 'csv_bank',
      transaction: row,
    });

    // The result should be 'groceries' (mapped from 'groceries' in rules)
    // NOT 'other' / 'Sonstiges'
    expect(result.category).toBe('groceries');
    expect(result.source).toBe('rule');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('categorizes Uber transaction as transport (not Sonstiges)', () => {
    const row: ParsedRow = {
      bookingDate: '2025-01-15',
      valutaDate: '2025-01-15',
      amountCents: -1523,
      currency: 'EUR',
      direction: 'out',
      accountId: 'test:account',
      accountIban: null,
      counterparty: 'UBER BV',
      counterpartyIban: null,
      mcc: null,
      reference: null,
      rawText: 'UBER *TRIP 12345 Berlin',
      raw: {},
    };

    const result = categorize({
      text: row.rawText ?? '',
      amount: row.amountCents / 100,
      amountCents: row.amountCents,
      iban: row.accountIban ?? null,
      counterpart: row.counterparty ?? null,
      payee: row.counterparty ?? null,
      memo: row.rawText,
      source: 'csv_bank',
      transaction: row,
    });

    // Should map 'transport:rideshare' -> 'transport' via CATEGORY_MAPPING
    expect(result.category).toBe('transport');
    expect(result.source).toBe('rule');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('categorizes Drillisch telecom transaction as telecom_internet (not Sonstiges)', () => {
    const row: ParsedRow = {
      bookingDate: '2025-01-15',
      valutaDate: '2025-01-15',
      amountCents: -2999,
      currency: 'EUR',
      direction: 'out',
      accountId: 'test:account',
      accountIban: null,
      counterparty: 'DRILLISCH ONLINE',
      counterpartyIban: null,
      mcc: null,
      reference: null,
      rawText: 'DRILLISCH ONLINE GMBH & CO. KG',
      raw: {},
    };

    const result = categorize({
      text: row.rawText ?? '',
      amount: row.amountCents / 100,
      amountCents: row.amountCents,
      iban: row.accountIban ?? null,
      counterpart: row.counterparty ?? null,
      payee: row.counterparty ?? null,
      memo: row.rawText,
      source: 'csv_bank',
      transaction: row,
    });

    // Should map 'subscriptions:telecom' -> 'telecom_internet' via CATEGORY_MAPPING
    expect(result.category).toBe('telecom_internet');
    expect(result.source).toBe('rule');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('pipeline: fuzzy matches LIDl sagt danke as groceries via merchant DB', () => {
    const row: ParsedRow = {
      bookingDate: '2025-01-15',
      valutaDate: '2025-01-15',
      amountCents: -2345,
      currency: 'EUR',
      direction: 'out',
      accountId: 'test:account',
      accountIban: null,
      counterparty: 'LIDl sagt danke koeln',
      counterpartyIban: null,
      mcc: null,
      reference: null,
      rawText: 'LIDl sagt danke koeln//Koeln/DE',
      raw: {},
    };

    const result = categorize({
      text: row.rawText ?? '',
      amount: row.amountCents / 100,
      amountCents: row.amountCents,
      iban: row.accountIban ?? null,
      counterpart: row.counterparty ?? null,
      payee: row.counterparty ?? null,
      memo: row.rawText,
      source: 'csv_bank',
      transaction: row,
    });

    // Should match via fuzzy merchant DB (typo: LIDl instead of LIDL)
    // Note: toCategorizeResult maps 'merchant-db-fuzzy' to 'rule' for API compatibility
    expect(result.category).toBe('groceries');
    expect(result.source).toBe('rule'); // API maps merchant-db-fuzzy to 'rule'
    expect(result.confidence).toBeGreaterThanOrEqual(0.80);
  });

  it('pipeline: fuzzy matches REWE Markt GmbH variant as groceries', () => {
    const row: ParsedRow = {
      bookingDate: '2025-01-15',
      valutaDate: '2025-01-15',
      amountCents: -4567,
      currency: 'EUR',
      direction: 'out',
      accountId: 'test:account',
      accountIban: null,
      counterparty: 'REWE Markt GmbH Köln',
      counterpartyIban: null,
      mcc: null,
      reference: null,
      rawText: 'REWE Markt GmbH Köln 12345',
      raw: {},
    };

    const result = categorize({
      text: row.rawText ?? '',
      amount: row.amountCents / 100,
      amountCents: row.amountCents,
      iban: row.accountIban ?? null,
      counterpart: row.counterparty ?? null,
      payee: row.counterparty ?? null,
      memo: row.rawText,
      source: 'csv_bank',
      transaction: row,
    });

    // Should match via fuzzy merchant DB (variant name)
    expect(result.category).toBe('groceries');
    // Could be either 'rule' (if system rule matches) or 'merchant-db-fuzzy'
    expect(['rule', 'merchant-db-fuzzy']).toContain(result.source);
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  describe('heuristic integration tests', () => {
    it('pipeline: salary transaction not covered by rules is caught by heuristic', () => {
      const row: ParsedRow = {
        bookingDate: '2025-01-31',
        valutaDate: '2025-01-31',
        amountCents: 350000, // €3,500.00
        currency: 'EUR',
        direction: 'in',
        accountId: 'test:account',
        accountIban: null,
        counterparty: 'Unknown Company AG',
        counterpartyIban: null,
        mcc: null,
        reference: null,
        rawText: 'Gehalt Januar 2025',
        raw: {},
      };

      const result = categorize({
        text: row.rawText ?? '',
        amount: row.amountCents / 100,
        amountCents: row.amountCents,
        iban: row.accountIban ?? null,
        counterpart: row.counterparty ?? null,
        payee: row.counterparty ?? null,
        memo: row.rawText,
        source: 'csv_bank',
        transaction: row,
      });

      // Should be categorized as salary (either via rule or heuristic), not "other"
      expect(result.category).toBe('income_salary');
      // Accept either 'rule' (if system rule matches) or 'heuristic:salary'
      expect(['rule', 'heuristic:salary']).toContain(result.source);
      expect(result.category).not.toBe('other');
    });

    it('pipeline: rent transaction not covered by rules is caught by heuristic', () => {
      const row: ParsedRow = {
        bookingDate: '2025-01-01',
        valutaDate: '2025-01-01',
        amountCents: -120000, // €1,200.00
        currency: 'EUR',
        direction: 'out',
        accountId: 'test:account',
        accountIban: null,
        counterparty: 'Hausverwaltung Müller GMBH',
        counterpartyIban: null,
        mcc: null,
        reference: null,
        rawText: 'Kaltmiete Januar 2025',
        raw: {},
      };

      const result = categorize({
        text: row.rawText ?? '',
        amount: row.amountCents / 100,
        amountCents: row.amountCents,
        iban: row.accountIban ?? null,
        counterpart: row.counterparty ?? null,
        payee: row.counterparty ?? null,
        memo: row.rawText,
        source: 'csv_bank',
        transaction: row,
      });

      // Should be categorized as rent (either via rule or heuristic), not "other"
      expect(result.category).toBe('rent');
      // Accept either 'rule' (if system rule matches) or 'heuristic:rent'
      expect(['rule', 'heuristic:rent']).toContain(result.source);
      expect(result.category).not.toBe('other');
    });
  });
});


