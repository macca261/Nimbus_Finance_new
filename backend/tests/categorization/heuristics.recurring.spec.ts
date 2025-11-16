import { describe, expect, it } from 'vitest';
import { detectRecurringPattern } from '../../src/categorization/heuristics';
import type { ParsedRow } from '../../src/parser/types';

describe('recurring transaction detection', () => {
  // Helper to create a date string N months ago
  const monthsAgo = (months: number): string => {
    const date = new Date();
    date.setMonth(date.getMonth() - months);
    return date.toISOString().split('T')[0];
  };

  it('detects recurring DRILLISCH telecom payments as subscriptions:telecom', () => {
    const history: ParsedRow[] = [
      {
        bookingDate: monthsAgo(2),
        valutaDate: monthsAgo(2),
        amountCents: -999, // €9.99
        currency: 'EUR',
        direction: 'out',
        accountId: 'test:account',
        accountIban: null,
        counterparty: 'DRILLISCH ONLINE GMBH',
        counterpartyIban: null,
        mcc: null,
        reference: null,
        rawText: 'DRILLISCH ONLINE GMBH & CO. KG',
        raw: {},
      },
      {
        bookingDate: monthsAgo(1),
        valutaDate: monthsAgo(1),
        amountCents: -999, // €9.99
        currency: 'EUR',
        direction: 'out',
        accountId: 'test:account',
        accountIban: null,
        counterparty: 'DRILLISCH ONLINE GMBH',
        counterpartyIban: null,
        mcc: null,
        reference: null,
        rawText: 'DRILLISCH ONLINE GMBH & CO. KG',
        raw: {},
      },
    ];

    const currentRow: ParsedRow = {
      bookingDate: new Date().toISOString().split('T')[0],
      valutaDate: new Date().toISOString().split('T')[0],
      amountCents: -999, // €9.99
      currency: 'EUR',
      direction: 'out',
      accountId: 'test:account',
      accountIban: null,
      counterparty: 'DRILLISCH ONLINE GMBH',
      counterpartyIban: null,
      mcc: null,
      reference: null,
      rawText: 'DRILLISCH ONLINE GMBH & CO. KG',
      raw: {},
    };

    const result = detectRecurringPattern(currentRow, history);

    expect(result).not.toBeNull();
    expect(result!.category).toBe('subscriptions:telecom');
    expect(result!.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result!.reason).toBe('recurring:telecom');
  });

  it('detects recurring insurance payments', () => {
    const history: ParsedRow[] = [
      {
        bookingDate: monthsAgo(2),
        valutaDate: monthsAgo(2),
        amountCents: -4500, // €45.00
        currency: 'EUR',
        direction: 'out',
        accountId: 'test:account',
        accountIban: null,
        counterparty: 'AOK KRANKENKASSE',
        counterpartyIban: null,
        mcc: null,
        reference: null,
        rawText: 'AOK KRANKENKASSE Monatsbeitrag',
        raw: {},
      },
      {
        bookingDate: monthsAgo(1),
        valutaDate: monthsAgo(1),
        amountCents: -4500, // €45.00
        currency: 'EUR',
        direction: 'out',
        accountId: 'test:account',
        accountIban: null,
        counterparty: 'AOK KRANKENKASSE',
        counterpartyIban: null,
        mcc: null,
        reference: null,
        rawText: 'AOK KRANKENKASSE Monatsbeitrag',
        raw: {},
      },
    ];

    const currentRow: ParsedRow = {
      bookingDate: new Date().toISOString().split('T')[0],
      valutaDate: new Date().toISOString().split('T')[0],
      amountCents: -4500, // €45.00
      currency: 'EUR',
      direction: 'out',
      accountId: 'test:account',
      accountIban: null,
      counterparty: 'AOK KRANKENKASSE',
      counterpartyIban: null,
      mcc: null,
      reference: null,
      rawText: 'AOK KRANKENKASSE Monatsbeitrag',
      raw: {},
    };

    const result = detectRecurringPattern(currentRow, history);

    expect(result).not.toBeNull();
    expect(result!.category).toBe('insurance');
    expect(result!.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result!.reason).toBe('recurring:insurance');
  });

  it('returns null for irregular/one-off payments', () => {
    const history: ParsedRow[] = [
      {
        bookingDate: monthsAgo(3),
        valutaDate: monthsAgo(3),
        amountCents: -5000, // €50.00
        currency: 'EUR',
        direction: 'out',
        accountId: 'test:account',
        accountIban: null,
        counterparty: 'RANDOM SHOP',
        counterpartyIban: null,
        mcc: null,
        reference: null,
        rawText: 'RANDOM SHOP Purchase',
        raw: {},
      },
    ];

    const currentRow: ParsedRow = {
      bookingDate: new Date().toISOString().split('T')[0],
      valutaDate: new Date().toISOString().split('T')[0],
      amountCents: -5000, // €50.00
      currency: 'EUR',
      direction: 'out',
      accountId: 'test:account',
      accountIban: null,
      counterparty: 'RANDOM SHOP',
      counterpartyIban: null,
      mcc: null,
      reference: null,
      rawText: 'RANDOM SHOP Purchase',
      raw: {},
    };

    const result = detectRecurringPattern(currentRow, history);

    // Should return null because we need at least 2 previous matches (3 total)
    expect(result).toBeNull();
  });

  it('returns null when amounts fluctuate too much', () => {
    const history: ParsedRow[] = [
      {
        bookingDate: monthsAgo(2),
        valutaDate: monthsAgo(2),
        amountCents: -10000, // €100.00
        currency: 'EUR',
        direction: 'out',
        accountId: 'test:account',
        accountIban: null,
        counterparty: 'DRILLISCH ONLINE GMBH',
        counterpartyIban: null,
        mcc: null,
        reference: null,
        rawText: 'DRILLISCH ONLINE GMBH & CO. KG',
        raw: {},
      },
      {
        bookingDate: monthsAgo(1),
        valutaDate: monthsAgo(1),
        amountCents: -50000, // €500.00 (too different)
        currency: 'EUR',
        direction: 'out',
        accountId: 'test:account',
        accountIban: null,
        counterparty: 'DRILLISCH ONLINE GMBH',
        counterpartyIban: null,
        mcc: null,
        reference: null,
        rawText: 'DRILLISCH ONLINE GMBH & CO. KG',
        raw: {},
      },
    ];

    const currentRow: ParsedRow = {
      bookingDate: new Date().toISOString().split('T')[0],
      valutaDate: new Date().toISOString().split('T')[0],
      amountCents: -10000, // €100.00
      currency: 'EUR',
      direction: 'out',
        accountId: 'test:account',
        accountIban: null,
        counterparty: 'DRILLISCH ONLINE GMBH',
        counterpartyIban: null,
        mcc: null,
        reference: null,
        rawText: 'DRILLISCH ONLINE GMBH & CO. KG',
        raw: {},
    };

    const result = detectRecurringPattern(currentRow, history);

    // Should return null because amounts fluctuate too much (>5% tolerance)
    expect(result).toBeNull();
  });

  describe('Uber subscriptions', () => {
    it('detects recurring Uber One subscription at 4.99 as transport:rideshare with heuristic:recurring', () => {
      const history: ParsedRow[] = [
        {
          bookingDate: '2025-07-01',
          valutaDate: '2025-07-01',
          amountCents: -499, // €4.99
          currency: 'EUR',
          direction: 'out',
          accountId: 'test:account',
          accountIban: null,
          counterparty: 'Uber BV',
          counterpartyIban: null,
          mcc: null,
          reference: null,
          rawText: 'Uber BV',
          raw: {},
        },
        {
          bookingDate: '2025-08-01',
          valutaDate: '2025-08-01',
          amountCents: -499, // €4.99
          currency: 'EUR',
          direction: 'out',
          accountId: 'test:account',
          accountIban: null,
          counterparty: 'Uber BV',
          counterpartyIban: null,
          mcc: null,
          reference: null,
          rawText: 'Uber BV',
          raw: {},
        },
      ];

      const currentRow: ParsedRow = {
        bookingDate: '2025-09-01',
        valutaDate: '2025-09-01',
        amountCents: -499, // €4.99
        currency: 'EUR',
        direction: 'out',
        accountId: 'test:account',
        accountIban: null,
        counterparty: 'Uber BV',
        counterpartyIban: null,
        mcc: null,
        reference: null,
        rawText: 'Uber BV',
        raw: {},
      };

      const result = detectRecurringPattern(currentRow, history);

      expect(result).not.toBeNull();
      expect(result!.category).toBe('transport:rideshare');
      expect(result!.confidence).toBeGreaterThanOrEqual(0.9);
      expect(result!.reason).toBe('heuristic:recurring');
    });

    it('does not treat one-off Uber ride as recurring subscription', () => {
      // Single transaction with large amount - should not be detected as recurring
      const currentRow: ParsedRow = {
        bookingDate: '2025-09-15',
        valutaDate: '2025-09-15',
        amountCents: -2684, // €26.84 (one-off ride)
        currency: 'EUR',
        direction: 'out',
        accountId: 'test:account',
        accountIban: null,
        counterparty: 'Uber BV',
        counterpartyIban: null,
        mcc: null,
        reference: null,
        rawText: 'Uber BV',
        raw: {},
      };

      // No history - single transaction
      const result = detectRecurringPattern(currentRow, []);

      // Should return null because we need at least 2 previous matches (3 total)
      expect(result).toBeNull();
    });

    it('detects recurring Uber Pass subscription at 3.00 as transport:rideshare with heuristic:recurring', () => {
      const history: ParsedRow[] = [
        {
          bookingDate: '2025-07-01',
          valutaDate: '2025-07-01',
          amountCents: -300, // €3.00
          currency: 'EUR',
          direction: 'out',
          accountId: 'test:account',
          accountIban: null,
          counterparty: 'Uber Payments BV',
          counterpartyIban: null,
          mcc: null,
          reference: null,
          rawText: 'Uber Payments BV UBER PASS',
          raw: {},
        },
        {
          bookingDate: '2025-08-01',
          valutaDate: '2025-08-01',
          amountCents: -300, // €3.00
          currency: 'EUR',
          direction: 'out',
          accountId: 'test:account',
          accountIban: null,
          counterparty: 'Uber Payments BV',
          counterpartyIban: null,
          mcc: null,
          reference: null,
          rawText: 'Uber Payments BV UBER PASS',
          raw: {},
        },
      ];

      const currentRow: ParsedRow = {
        bookingDate: '2025-09-01',
        valutaDate: '2025-09-01',
        amountCents: -300, // €3.00
        currency: 'EUR',
        direction: 'out',
        accountId: 'test:account',
        accountIban: null,
        counterparty: 'Uber Payments BV',
        counterpartyIban: null,
        mcc: null,
        reference: null,
        rawText: 'Uber Payments BV UBER PASS',
        raw: {},
      };

      const result = detectRecurringPattern(currentRow, history);

      expect(result).not.toBeNull();
      expect(result!.category).toBe('transport:rideshare');
      expect(result!.confidence).toBeGreaterThanOrEqual(0.95); // Higher confidence with subscription keyword
      expect(result!.reason).toBe('heuristic:recurring');
    });
  });
});

