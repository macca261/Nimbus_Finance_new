import { describe, expect, it } from 'vitest';
import { categorizeTransaction, mapNimbusCategoryToLegacy } from '../../src/categorization';
import { buildCategorizationExplanation } from '../../src/categorization/explanation';
import { isCashWithdrawalLike } from '../../src/categorization/cashMatcher';
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

  it('prevents comdirect transfer text from being misclassified as Uber/transport', () => {
    // Exact purpose text from transaction 414 that was incorrectly classified as transport:rideshare
    const purpose = 'Übertrag / Überweisung | Empfänger: Aaron McIntoshKto/IBAN: DE32200411770270381700 BLZ/BIC: COBADEHD077  Ref. 5I2C21PU02US856E/42431';
    
    const row: ParsedRow = {
      bookingDate: '2025-09-15',
      amountCents: -270000,
      rawText: purpose,
      counterparty: 'Aaron McIntosh',
      direction: 'out',
      accountId: 'account:giro',
      currency: 'EUR',
      reference: null,
      mcc: null,
      accountIban: null,
      counterpartyIban: 'DE32200411770270381700', // IBAN extracted from purpose
      externalId: null,
      normalizedText: undefined,
      categorySystem: undefined,
      raw: {},
    };
    
    const result = categorizeTransaction(row);
    
    // Critical: Must NOT be transport/Uber
    expect(result.category.startsWith('transport')).toBe(false);
    expect(result.category).not.toBe('transport');
    expect(result.category).not.toBe('transport:rideshare');
    
    // Should be internal transfer category if isInternalTransfer is set
    // (This test verifies the Uber rule guard, not the full internal transfer detection)
    // The guard should prevent "Übertrag" from matching Uber
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

  it('categorizes KFC as dining:fast_food', () => {
    const row: ParsedRow = {
      bookingDate: '2025-10-10',
      amountCents: -1250,
      rawText: 'Lastschrift / Belastung | Auftraggeber: KFC Buchungstext: KFC KOELN DE Karte Nr. 4871 78XX XXXX 1230 Kartenzahlung comdirect Visa-Debitkarte 2025-10-10 12:34:56 Ref. XYZ123',
      counterparty: 'KFC',
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
    
    expect(result.category).toBe('dining:fast_food');
    expect(result.category.startsWith('other')).toBe(false);
    expect(result.categoryConfidence).toBeGreaterThanOrEqual(0.7);
  });

  it('categorizes Action discount store as shopping:discount_store', () => {
    const row: ParsedRow = {
      bookingDate: '2025-10-08',
      amountCents: -3500,
      rawText: 'Lastschrift / Belastung | Auftraggeber: ACTION Deutschland GmbH Buchungstext: ACTION 1234 KOELN DE Karte Nr. 4871 78XX XXXX 1230 Kartenzahlung comdirect Visa-Debitkarte 2025-10-08 15:23:11 Ref. ABC456',
      counterparty: 'ACTION Deutschland GmbH',
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
    
    expect(result.category).toBe('shopping:discount_store');
    expect(result.category.startsWith('other')).toBe(false);
    expect(result.categoryConfidence).toBeGreaterThanOrEqual(0.7);
  });

  it('categorizes Café transaction as dining:cafe', () => {
    const row: ParsedRow = {
      bookingDate: '2025-10-09',
      amountCents: -680,
      rawText: 'Lastschrift / Belastung | Auftraggeber: CAFE RHEINBLICK Buchungstext: CAFÉ RHEINBLICK KOELN DE Karte Nr. 4871 78XX XXXX 1230 Kartenzahlung comdirect Visa-Debitkarte 2025-10-09 14:22:33 Ref. DEF789',
      counterparty: 'CAFE RHEINBLICK',
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
    
    expect(result.category).toBe('dining:cafe');
    expect(result.category.startsWith('other')).toBe(false);
    expect(result.categoryConfidence).toBeGreaterThanOrEqual(0.7);
  });

  it('categorizes Aral Station as transport:fuel', () => {
    const row: ParsedRow = {
      bookingDate: '2025-10-05',
      amountCents: -6500,
      rawText: 'Lastschrift / Belastung | Auftraggeber: Aral Station 141726125 Buchungstext: Aral Station 141726125, Koeln DE Karte Nr. 4871 78XX XXXX 1230 Kartenzahlung comdirect Visa-Debitkarte 2025-10-05 00:00:00 Ref. 8Y2C21S00Y1Z9R96/75168',
      counterparty: 'Aral Station 141726125',
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
    
    expect(result.category).toBe('transport:fuel');
    expect(result.category.startsWith('other')).toBe(false);
    expect(result.categoryConfidence).toBeGreaterThanOrEqual(0.7);
  });

  it('categorizes cash withdrawal (AUSZAHLUNG GAA) as cash:withdrawal', () => {
    const row: ParsedRow = {
      bookingDate: '2025-10-05',
      amountCents: -5000,
      rawText: 'Auszahlung GAA | Auftraggeber: DEUTSCHE BANK AG Bargeldauszahlung Ref. ABC123',
      counterparty: 'DEUTSCHE BANK AG',
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
    // Set isCashWithdrawal flag (normally set during import)
    (row as any).isCashWithdrawal = true;
    
    const result = categorizeTransaction(row);
    
    expect(result.category).toBe('cash:withdrawal');
    const legacyCategory = mapNimbusCategoryToLegacy(result.category);
    expect(legacyCategory).toBe('cash_withdrawal');
    expect(result.categoryConfidence).toBeGreaterThanOrEqual(0.95);
    expect(result.categorySource).toBe('system');
    if (result.categoryExplanation) {
      expect(result.categoryExplanation.ruleId).toBe('cash_withdrawal:auto');
    }
  });

  it('categorizes comdirect cash withdrawal (real-world text) as cash:withdrawal', () => {
    // Real-world example from comdirect CSV
    // "Auszahlung GAA | Auftraggeber: DEUTSCHE BANK Buchungstext: Bargeldauszahlung Deutsche Bank//Köln/DE 2025-09-26T19:59:22 KFN 0 VJ 2612 Ref. 7E2C21PT2VYY897P/11596"
    const row: ParsedRow = {
      bookingDate: '2025-09-26',
      amountCents: -5000,
      rawText: 'Auszahlung GAA | Auftraggeber: DEUTSCHE BANK Buchungstext: Bargeldauszahlung Deutsche Bank//Köln/DE 2025-09-26T19:59:22 KFN 0 VJ 2612 Ref. 7E2C21PT2VYY897P/11596',
      counterparty: 'DEUTSCHE BANK',
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
      raw: {
        bankProfile: 'comdirect',
      },
    };
    // Don't set isCashWithdrawal manually - test that detection works from text
    // In real import, normalizeCanonicalRow would detect this and set the flag
    // For this unit test, we simulate the detection result
    
    // First, verify the detection logic would work
    const purpose = row.rawText;
    const memo = null;
    const bankProfile = 'comdirect';
    const wouldBeDetected = isCashWithdrawalLike(purpose, memo, bankProfile);
    expect(wouldBeDetected).toBe(true);
    
    // Now test categorization with the flag set (as it would be after import)
    (row as any).isCashWithdrawal = true;
    
    const result = categorizeTransaction(row);
    
    expect(result.category).toBe('cash:withdrawal');
    const legacyCategory = mapNimbusCategoryToLegacy(result.category);
    expect(legacyCategory).toBe('cash_withdrawal');
    expect(result.categoryConfidence).toBeGreaterThanOrEqual(0.95);
    expect(result.categorySource).toBe('system');
  });

  it('categorizes cash withdrawal (Bargeldauszahlung) as cash:withdrawal', () => {
    const row: ParsedRow = {
      bookingDate: '2025-10-06',
      amountCents: -3000,
      rawText: 'Bargeldauszahlung Deutsche Bank ATM Ref. DEF456',
      counterparty: 'Deutsche Bank',
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
    // Set isCashWithdrawal flag (normally set during import)
    (row as any).isCashWithdrawal = true;
    
    const result = categorizeTransaction(row);
    
    expect(result.category).toBe('cash:withdrawal');
    const legacyCategory = mapNimbusCategoryToLegacy(result.category);
    expect(legacyCategory).toBe('cash_withdrawal');
    expect(result.categoryConfidence).toBeGreaterThanOrEqual(0.95);
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

  // ============================================
  // REGRESSION TESTS: Internal transfers and salary mislabeled as Transport
  // ============================================

  it('categorizes transfer to Aaron (savings IBAN) as internal transfer, NOT transport (unit test)', () => {
    const row: ParsedRow = {
      bookingDate: '2025-09-15',
      amountCents: -270000, // -2700 EUR
      rawText: 'Übertrag / Überweisung | Empfänger: Aaron McIntoshKto/IBAN: DE32200411770270381700 BLZ/BIC: COBADEHD077 Ref. 5I2C21PU02U8S56E/42431',
      counterparty: 'Aaron McIntosh',
      direction: 'out',
      accountId: 'account:giro',
      currency: 'EUR',
      reference: null,
      mcc: null,
      accountIban: 'DE12345678901234567890',
      counterpartyIban: 'DE32200411770270381700',
      externalId: null,
      normalizedText: undefined,
      categorySystem: undefined,
      raw: {},
      isInternalTransfer: true, // Simulate that internal transfer matcher already set this
      internalTransferKind: 'savings',
      internalTransferDirection: 'out',
    };
    
    const result = categorizeTransaction(row);
    
    // Must be an internal transfer category, NOT transport
    expect(result.category).toMatch(/^internal:transfer/);
    expect(result.category.startsWith('transport')).toBe(false);
    expect(result.categorySource).toBe('system');
    if (result.categoryRuleId) {
      expect(result.categoryRuleId).toMatch(/internal_transfer/);
    }
  });

  it('categorizes transfer to Rukiye as internal transfer, NOT transport (unit test)', () => {
    const row: ParsedRow = {
      bookingDate: '2025-09-16',
      amountCents: -55600, // -556 EUR
      rawText: 'Übertrag / Überweisung | Empfänger: Rukiye AksoyKto/IBAN: DE93370501980012173696 BLZ/BIC: COLSDE33XXX Ref. 9Q2C21PU3JKASIIY/1734',
      counterparty: 'Rukiye Aksoy',
      direction: 'out',
      accountId: 'account:giro',
      currency: 'EUR',
      reference: null,
      mcc: null,
      accountIban: 'DE12345678901234567890',
      counterpartyIban: 'DE93370501980012173696',
      externalId: null,
      normalizedText: undefined,
      categorySystem: undefined,
      raw: {},
      isInternalTransfer: true, // Simulate that internal transfer matcher already set this
      internalTransferKind: 'other',
      internalTransferDirection: 'out',
    };
    
    const result = categorizeTransaction(row);
    
    // Must be an internal transfer category, NOT transport
    expect(result.category).toMatch(/^internal:transfer/);
    expect(result.category.startsWith('transport')).toBe(false);
    expect(result.categorySource).toBe('system');
  });

  it('categorizes salary from AMORIA BOND as income:salary, NOT transport (unit test)', () => {
    const row: ParsedRow = {
      bookingDate: '2025-09-30',
      amountCents: 310100, // +3101 EUR
      rawText: 'Übertrag / Überweisung | Auftraggeber: AMORIA BOND GMBH Buchungstext: Lohn / Gehalt 09/2025 Ref. AC2C21PT3OKI0AWJ/84479',
      counterparty: 'AMORIA BOND GMBH',
      direction: 'in',
      accountId: 'account:giro',
      currency: 'EUR',
      reference: null,
      mcc: null,
      accountIban: 'DE12345678901234567890',
      counterpartyIban: null,
      externalId: null,
      normalizedText: undefined,
      categorySystem: undefined,
      raw: {},
    };
    
    const result = categorizeTransaction(row);
    
    // Must be income:salary, NOT transport
    expect(result.category).toBe('income:salary');
    expect(result.category.startsWith('transport')).toBe(false);
    expect(result.categoryConfidence).toBeGreaterThanOrEqual(0.85);
  });

  it('categorizes Wise wallet top-up as internal:transfer_wallet', () => {
    // Real-world example: Wise card top-up transaction
    const row: ParsedRow = {
      bookingDate: '2025-10-05',
      amountCents: -5000, // -50 EUR
      rawText: 'Kartenverfügung | Buchungstext: Wise, Bruxelles BE Karte Nr. 4871 78XX XXXX 1230 Kartenzahlung comdirect Visa-Debitkarte 2025-10-05 00:00:00 Ref. 9M2C21RZ14U57NLY/59017',
      counterparty: 'Wise, Bruxelles',
      direction: 'out',
      accountId: 'account:giro',
      currency: 'EUR',
      reference: null,
      mcc: null,
      accountIban: 'DE12345678901234567890',
      counterpartyIban: null, // No IBAN for card transactions
      externalId: null,
      normalizedText: undefined,
      categorySystem: undefined,
      raw: {
        bankProfile: 'comdirect',
      },
      // The internal transfer matcher should set these during import
      isInternalTransfer: true,
      internalTransferKind: 'wallet',
      internalTransferDirection: 'out',
    };
    
    const result = categorizeTransaction(row);
    
    // Must be internal:transfer_wallet, NOT transport or other
    expect(result.category).toBe('internal:transfer_wallet');
    expect(result.category.startsWith('transport')).toBe(false);
    expect(result.category).not.toBe('other');
    expect(result.category).not.toBe('other_review');
    const legacyCategory = mapNimbusCategoryToLegacy(result.category);
    expect(legacyCategory).toBe('transfer_internal');
    expect(result.categorySource).toBe('system');
    expect(result.categoryConfidence).toBeGreaterThanOrEqual(0.9);
  });

  it('categorizes BILDWERK FOTOAUTOMAT as shopping, NOT Sonstiges', () => {
    // Real-world example: Photo booth transaction
    const row: ParsedRow = {
      bookingDate: '2025-10-04',
      amountCents: -600, // -6 EUR
      rawText: 'Lastschrift / Belastung | Auftraggeber: BILDWERK FOTOAUTOMAT Buchungstext: BILDWERK FOTOAUTOMAT, MECHERNICH D E Karte Nr. 4871 78XX XXXX 1230 Kartenzahlung comdirect Visa-Debitkarte 2025-10-04 00:00:00 Ref. 7Z2C21RY11E5RXX/63325',
      counterparty: 'BILDWERK FOTOAUTOMAT',
      direction: 'out',
      accountId: 'account:giro',
      currency: 'EUR',
      reference: null,
      mcc: null,
      accountIban: 'DE12345678901234567890',
      counterpartyIban: null,
      externalId: null,
      normalizedText: undefined,
      categorySystem: undefined,
      raw: {
        bankProfile: 'comdirect',
      },
    };
    
    const result = categorizeTransaction(row);
    
    // Must be shopping (or an entertainment category), NOT other/Sonstiges
    expect(result.category).toBe('shopping');
    expect(result.category).not.toBe('other');
    expect(result.category).not.toBe('other_review');
    expect(result.categoryConfidence).toBeGreaterThan(0.7);
    const legacyCategory = mapNimbusCategoryToLegacy(result.category);
    expect(legacyCategory).toBe('shopping');
  });
});

