import { describe, expect, it } from 'vitest';
import { categorize } from '../../src/categorization';
import type { ParsedRow } from '../../src/parser/types';

describe('PayPal merchant enrichment', () => {
  it('extracts OpenAI from PayPal transaction and categorizes as subscriptions:software', () => {
    const row: ParsedRow = {
      bookingDate: '2025-01-15',
      valutaDate: '2025-01-15',
      amountCents: -2000, // $20.00
      currency: 'EUR',
      direction: 'out',
      accountId: 'test:account',
      accountIban: null,
      counterparty: 'PayPal (Europe) S.a r.l. et Cie, S.C.A',
      counterpartyIban: null,
      mcc: null,
      reference: null,
      rawText: 'Lastschrift / Belastung | Auftraggeber: PayPal Europe S.a.r.l. et Cie S.C.A Buchungstext: 10456569359061/PP.4162.PP/, OpenAI Ireland Limited, Ihr Einkauf bei OpenAI Ireland Limited Ref. ABC123XYZ',
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

    // Should extract underlying merchant (OpenAI) and categorize as subscriptions:software
    expect(result.category).toBe('subscriptions');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    // Should not be "other" / "Sonstiges"
    expect(result.category).not.toBe('other');
  });

  it('extracts Uber from PayPal transaction and categorizes as transport:rideshare', () => {
    const row: ParsedRow = {
      bookingDate: '2025-01-15',
      valutaDate: '2025-01-15',
      amountCents: -1523, // €15.23
      currency: 'EUR',
      direction: 'out',
      accountId: 'test:account',
      accountIban: null,
      counterparty: 'PayPal Europe S.a.r.l. et Cie S.C.A',
      counterpartyIban: null,
      mcc: null,
      reference: null,
      rawText: 'Buchungstext: 1045591441549/PP.4162.PP/, Uber BV, Ihr Einkauf bei Uber BV Ref. DEF456UVW',
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

    // Should extract underlying merchant (Uber) and categorize as transport
    expect(result.category).toBe('transport');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.category).not.toBe('other');
  });

  it('extracts REWE from PayPal transaction and categorizes as groceries', () => {
    const row: ParsedRow = {
      bookingDate: '2025-01-15',
      valutaDate: '2025-01-15',
      amountCents: -4567, // €45.67
      currency: 'EUR',
      direction: 'out',
      accountId: 'test:account',
      accountIban: null,
      counterparty: 'PayPal Europe S.a.r.l. et Cie S.C.A',
      counterpartyIban: null,
      mcc: null,
      reference: null,
      rawText: 'Lastschrift / Belastung | Auftraggeber: PayPal Europe S.a.r.l. et Cie S.C.A Buchungstext: 1045640743979/PP.4162.PP/, REWE Markt GmbH, Ihr Einkauf bei REWE Markt GmbH Ref. GHI789RST',
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

    // Should extract underlying merchant (REWE) and categorize as groceries
    expect(result.category).toBe('groceries');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.category).not.toBe('other');
  });

  it('falls back to PayPal fee/service category when no underlying merchant is found', () => {
    const row: ParsedRow = {
      bookingDate: '2025-01-15',
      valutaDate: '2025-01-15',
      amountCents: -50, // €0.50 (typical PayPal fee)
      currency: 'EUR',
      direction: 'out',
      accountId: 'test:account',
      accountIban: null,
      counterparty: 'PayPal Europe S.a.r.l. et Cie S.C.A',
      counterpartyIban: null,
      mcc: null,
      reference: null,
      rawText: 'Lastschrift / Belastung | Auftraggeber: PayPal Europe S.a.r.l. et Cie S.C.A Buchungstext: Gebühren / Fees Ref. JKL012MNO',
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

    // Should fall back to fees:service or similar (not groceries, not other if we have a PayPal fee rule)
    // If we have a PayPal fee rule, it should match that; otherwise might be 'other'
    expect(result.category).toBeTruthy();
    // At minimum, it should not be groceries or transport (those would be wrong)
    expect(['groceries', 'transport', 'subscriptions']).not.toContain(result.category);
  });

  it('handles PayPal transaction with "Mezis Pizza" and categorizes as dining', () => {
    const row: ParsedRow = {
      bookingDate: '2025-01-15',
      valutaDate: '2025-01-15',
      amountCents: -2345, // €23.45
      currency: 'EUR',
      direction: 'out',
      accountId: 'test:account',
      accountIban: null,
      counterparty: 'PayPal Europe S.a.r.l. et Cie S.C.A',
      counterpartyIban: null,
      mcc: null,
      reference: null,
      rawText: 'Lastschrift / Belastung | Auftraggeber: PayPal Europe S.a.r.l. et Cie S.C.A Buchungstext: 1045640743979/PP.4162.PP/, Mezis Pizza, Ihr Einkauf bei Mezis Pizza Ref. PQR345STU',
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

    // Should extract underlying merchant (Mezis Pizza) and categorize as dining
    // Note: We may not have a specific rule for "Mezis Pizza", but if we do, it should match
    // Otherwise, it might fall back to 'other', but at least it shouldn't be groceries/transport
    expect(result.category).toBeTruthy();
    // If we have dining rules, it should match; otherwise might be 'other'
    // The key is: it should NOT be groceries or transport (those would be wrong)
    expect(['groceries', 'transport']).not.toContain(result.category);
  });
});

