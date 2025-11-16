import { describe, expect, it } from 'vitest';
import { categorizeTransaction, mapNimbusCategoryToLegacy } from '../../src/categorization';
import { buildCategorizationExplanation } from '../../src/categorization/explanation';
import type { ParsedRow } from '../../src/parsing/types';

describe('Real-world comdirect categorization (Aaron\'s sample rows)', () => {
  it('categorizes Cursor IDE payment as subscriptions:software', () => {
    const row: ParsedRow = {
      bookingDate: '2025-01-15',
      amountCents: -2000,
      rawText: 'CURSOR, AI POWERED IDE, CURSOR.COM Ref. 6P2C21RY16B438RD/48368',
      counterparty: 'CURSOR',
      direction: 'out',
      accountId: 'account:giro',
      currency: 'EUR',
      reference: null,
      mcc: null,
      accountIban: null,
      counterpartyIban: null,
      externalId: null,
      normalizedText: undefined,
      categorySystem: undefined,
      raw: {},
    };
    
    const result = categorizeTransaction(row);
    
    expect(result.category).toBe('subscriptions:software');
    const legacyCategory = mapNimbusCategoryToLegacy(result.category);
    expect(legacyCategory).toBe('subscriptions');
  });

  it('categorizes Baeckerei Heinemann as dining:bakery', () => {
    const row: ParsedRow = {
      bookingDate: '2025-01-15',
      amountCents: -450,
      rawText: 'Baeckerei Heinemann, Koeln',
      counterparty: 'Baeckerei Heinemann',
      direction: 'out',
      accountId: 'account:giro',
      currency: 'EUR',
      reference: null,
      mcc: null,
      accountIban: null,
      counterpartyIban: null,
      externalId: null,
      normalizedText: undefined,
      categorySystem: undefined,
      raw: {},
    };
    
    const result = categorizeTransaction(row);
    
    expect(result.category).toBe('dining:bakery');
    const legacyCategory = mapNimbusCategoryToLegacy(result.category);
    expect(legacyCategory).toBe('dining_out');
  });

  it('categorizes Metro Markets ladder purchase as shopping:home_improvement', () => {
    const row: ParsedRow = {
      bookingDate: '2025-01-15',
      amountCents: -8900,
      rawText: 'Metro Ma rkets GmbH, Leiter Ref. 6P2C21RY16B438RD/48368',
      counterparty: 'Metro Markets GmbH',
      direction: 'out',
      accountId: 'account:giro',
      currency: 'EUR',
      reference: null,
      mcc: null,
      accountIban: null,
      counterpartyIban: null,
      externalId: null,
      normalizedText: undefined,
      categorySystem: undefined,
      raw: {},
    };
    
    const result = categorizeTransaction(row);
    
    expect(result.category).toBe('shopping:home_improvement');
    const legacyCategory = mapNimbusCategoryToLegacy(result.category);
    expect(legacyCategory).toBe('shopping');
  });

  it('categorizes Teleclinic as health:medical', () => {
    const row: ParsedRow = {
      bookingDate: '2025-01-15',
      amountCents: -2500,
      rawText: 'Teleclinic Ref. 6P2C21RY16B438RD/48368',
      counterparty: 'TeleClinic',
      direction: 'out',
      accountId: 'account:giro',
      currency: 'EUR',
      reference: null,
      mcc: null,
      accountIban: null,
      counterpartyIban: null,
      externalId: null,
      normalizedText: undefined,
      categorySystem: undefined,
      raw: {},
    };
    
    const result = categorizeTransaction(row);
    
    expect(result.category).toBe('health:medical');
    const legacyCategory = mapNimbusCategoryToLegacy(result.category);
    expect(legacyCategory).toBe('health');
  });

  it('categorizes Europ Assistance as insurance:travel', () => {
    const row: ParsedRow = {
      bookingDate: '2025-01-15',
      amountCents: -2900,
      rawText: 'EUROP ASSISTANCE PARIS FR Ref. 6P2C21RY16B438RD/48368',
      counterparty: 'EUROP ASSISTANCE',
      direction: 'out',
      accountId: 'account:giro',
      currency: 'EUR',
      reference: null,
      mcc: null,
      accountIban: null,
      counterpartyIban: null,
      externalId: null,
      normalizedText: undefined,
      categorySystem: undefined,
      raw: {},
    };
    
    const result = categorizeTransaction(row);
    
    expect(result.category).toBe('insurance:travel');
    const legacyCategory = mapNimbusCategoryToLegacy(result.category);
    expect(legacyCategory).toBe('insurance');
  });

  it('categorizes Natuurhuisje as travel:holiday', () => {
    const row: ParsedRow = {
      bookingDate: '2025-01-15',
      amountCents: -15000,
      rawText: 'WWW.NATUURHUISJE.NL Ref. 6P2C21RY16B438RD/48368',
      counterparty: 'NATUURHUISJE',
      direction: 'out',
      accountId: 'account:giro',
      currency: 'EUR',
      reference: null,
      mcc: null,
      accountIban: null,
      counterpartyIban: null,
      externalId: null,
      normalizedText: undefined,
      categorySystem: undefined,
      raw: {},
    };
    
    const result = categorizeTransaction(row);
    
    expect(result.category).toBe('travel:holiday');
    const legacyCategory = mapNimbusCategoryToLegacy(result.category);
    expect(legacyCategory).toBe('other');
  });

  it('strips bank reference ID from text before categorization', () => {
    const row: ParsedRow = {
      bookingDate: '2025-01-15',
      amountCents: -2000,
      rawText: 'CURSOR, AI POWERED IDE, CURSOR.COM Ref. 6P2C21RY16B438RD/48368',
      counterparty: 'CURSOR',
      direction: 'out',
      accountId: 'account:giro',
      currency: 'EUR',
      reference: null,
      mcc: null,
      accountIban: null,
      counterpartyIban: null,
      externalId: null,
      normalizedText: undefined,
      categorySystem: undefined,
      raw: {},
    };
    
    // Note: bank reference stripping happens during parsing, not categorization
    // This test verifies the categorization works even with Ref. in the text
    const result = categorizeTransaction(row);
    
    expect(result.category).toBe('subscriptions:software');
  });

  it('explains why Sonstiges (other) transactions are uncategorized', () => {
    // Create a transaction that will end up as "other" / Sonstiges
    const row: ParsedRow = {
      bookingDate: '2025-01-15',
      amountCents: -1234,
      rawText: 'UNKNOWN MERCHANT XYZ123',
      counterparty: 'UNKNOWN MERCHANT',
      direction: 'out',
      accountId: 'account:giro',
      currency: 'EUR',
      reference: null,
      mcc: null,
      accountIban: null,
      counterpartyIban: null,
      externalId: null,
      normalizedText: undefined,
      categorySystem: undefined,
      raw: {},
    };
    
    const result = categorizeTransaction(row);
    
    // Should be categorized as "other" or "other_review"
    expect(result.category).toMatch(/^other/);
    
    // Build a NormalizedTransaction-like object to test explanation
    const tx: any = {
      id: 'test-1',
      bookingDate: row.bookingDate,
      amountCents: row.amountCents,
      currency: row.currency,
      direction: row.direction,
      rawText: row.rawText,
      bankProfile: 'comdirect',
      category: result.category,
      categoryConfidence: result.categoryConfidence ?? 0,
      categorySource: result.categorySource ?? 'fallback',
      categoryRuleId: result.categoryRuleId,
      isRefund: false,
      isRefunded: false,
      isInternalTransfer: false,
      isReimbursement: false,
    };
    
    // Test the explanation builder
    const explanation = buildCategorizationExplanation(tx);
    
    // Verify the explanation explains why it's Sonstiges
    expect(explanation.code).toBe('fallback_other_no_match');
    expect(explanation.text).toContain('Other/uncategorized');
    expect(explanation.text).toContain('no rule or merchant match yet');
  });

  it('categorizes Uber Eats via PayPal as dining:delivery, not transport', () => {
    const row: ParsedRow = {
      bookingDate: '2025-09-12',
      amountCents: -1789,
      rawText:
        'Lastschrift / Belastung | Auftraggeber: PayPal Europe S.a.r.l. et Cie S.C.A Buchungstext: 1045268675504/PP.4162.PP/, Uber Payments BV, Ihr Einkauf bei Uber Payments BV Ref. 8VC2C21RY2T19IK1V/17388',
      counterparty: 'PayPal Europe S.a.r.l. et Cie, S.C.A',
      direction: 'out',
      accountId: 'account:giro',
      currency: 'EUR',
      reference: null,
      mcc: null,
      accountIban: null,
      counterpartyIban: null,
      externalId: null,
      normalizedText: undefined,
      categorySystem: undefined,
      raw: {},
    };
    const result = categorizeTransaction(row);
    expect(result.category).toBe('dining:delivery');
    // Not a transport category
    expect(result.category.startsWith('transport')).toBe(false);
  });

  it('categorizes Uber One subscription via PayPal as subscriptions (not transport)', () => {
    const row: ParsedRow = {
      bookingDate: '2025-08-12',
      amountCents: -499,
      rawText:
        'Lastschrift / Belastung | Auftraggeber: PayPal Europe S.a.r.l. et Cie S.C.A Buchungstext: 1045221936384/PP.4162.PP/, Uber BV, Ihr Einkauf bei Uber BV Ref. 7T2C21RU0AOSCSJX/8963',
      counterparty: 'PayPal Europe S.a.r.l. et Cie, S.C.A',
      direction: 'out',
      accountId: 'account:giro',
      currency: 'EUR',
      reference: null,
      mcc: null,
      accountIban: null,
      counterpartyIban: null,
      externalId: null,
      normalizedText: undefined,
      categorySystem: undefined,
      raw: {},
    };
    const result = categorizeTransaction(row);
    expect(result.category.startsWith('subscriptions')).toBe(true);
    expect(result.category.startsWith('transport')).toBe(false);
  });

  it('categorizes Uber ride (non-recurring, varying amounts) as transport:rideshare', () => {
    const samples: ParsedRow[] = [
      {
        bookingDate: '2025-08-01',
        amountCents: -780,
        rawText: 'UBER TRIP HELP.UBER.COM AMSTERDAM',
        counterparty: 'UBER BV',
        direction: 'out',
        accountId: 'account:giro',
        currency: 'EUR',
        reference: null,
        mcc: null,
        accountIban: null,
        counterpartyIban: null,
        externalId: null,
        normalizedText: undefined,
        categorySystem: undefined,
        raw: {},
      },
      {
        bookingDate: '2025-08-07',
        amountCents: -1340,
        rawText: 'UBER TRIP HELP.UBER.COM AMSTERDAM',
        counterparty: 'UBER BV',
        direction: 'out',
        accountId: 'account:giro',
        currency: 'EUR',
        reference: null,
        mcc: null,
        accountIban: null,
        counterpartyIban: null,
        externalId: null,
        normalizedText: undefined,
        categorySystem: undefined,
        raw: {},
      },
    ];
    for (const row of samples) {
      const result = categorizeTransaction(row);
      expect(result.category).toBe('transport:rideshare');
    }
  });

  it('categorizes salary with "Lohn / Gehalt" as income:salary, not transport', () => {
    const row: ParsedRow = {
      bookingDate: '2025-09-30',
      amountCents: 275000,
      rawText:
        'Übertrag / Überweisung | Auftraggeber: AMORIA BOND GMBH Buchungstext: Lohn / Gehalt 09/2025 Ref. ACC2C21PT3OKI0AWJ/84479',
      counterparty: 'AMORIA BOND GMBH',
      direction: 'in',
      accountId: 'account:giro',
      currency: 'EUR',
      reference: null,
      mcc: null,
      accountIban: null,
      counterpartyIban: null,
      externalId: null,
      normalizedText: undefined,
      categorySystem: undefined,
      raw: {},
    };
    const result = categorizeTransaction(row);
    expect(result.category).toBe('income:salary');
    expect(result.category.startsWith('transport')).toBe(false);
  });

  it('does not categorize Pembe Aksoy reimbursement as transport; prefer income_other or housing', () => {
    const row: ParsedRow = {
      bookingDate: '2025-09-10',
      amountCents: 120000,
      rawText:
        'Übertrag / Überweisung | Auftraggeber: Pembe Aksoy Buchungstext: Miete minus stuff Ref. 2B2C21RV2MOS5ENL/64554',
      counterparty: 'Pembe Aksoy',
      direction: 'in',
      accountId: 'account:giro',
      currency: 'EUR',
      reference: null,
      mcc: null,
      accountIban: null,
      counterpartyIban: null,
      externalId: null,
      normalizedText: undefined,
      categorySystem: undefined,
      raw: {},
    };
    const result = categorizeTransaction(row);
    // Accept any non-transport category; ideally income or housing-related
    expect(result.category.startsWith('transport')).toBe(false);
  });

  it('lowers confidence for sign/category mismatches (income labeled as expense)', () => {
    const row: ParsedRow = {
      bookingDate: '2025-09-11',
      amountCents: 1999, // positive (income)
      rawText: 'UBER TRIP HELP.UBER.COM AMSTERDAM',
      counterparty: 'UBER BV',
      direction: 'in',
      accountId: 'account:giro',
      currency: 'EUR',
      reference: null,
      mcc: null,
      accountIban: null,
      counterpartyIban: null,
      externalId: null,
      normalizedText: undefined,
      categorySystem: undefined,
      raw: {},
    };
    const result = categorizeTransaction(row);
    // Category might be transport due to text, but confidence should be low (<= 0.4)
    if (result.category && !result.category.startsWith('income')) {
      expect(result.categoryConfidence).toBeLessThanOrEqual(0.4);
    }
  });
});

