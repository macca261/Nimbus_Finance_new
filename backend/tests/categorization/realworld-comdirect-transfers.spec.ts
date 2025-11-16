import { describe, it, expect, beforeEach } from 'vitest';
import { openDb, ensureSchema, insertTransactions, type CanonicalRow } from '../../src/db';
import type { Database } from '../../src/db';

describe('Real-world comdirect transfers – integration tests', () => {
  let db: Database;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.TEST_DB = '1';
    db = openDb();
    ensureSchema(db);
    
    // Seed accounts for internal transfer detection
    // Aaron's savings account
    db.prepare(`INSERT OR IGNORE INTO accounts (id, iban, name, role) VALUES (?, ?, ?, ?)`).run(
      'aaron-savings',
      'DE32200411770270381700',
      'Aaron McIntosh Savings',
      'savings'
    );
    // Rukiye's account (not marked as savings, so will be 'other' kind)
    db.prepare(`INSERT OR IGNORE INTO accounts (id, iban, name, role) VALUES (?, ?, ?, ?)`).run(
      'rukiye-account',
      'DE93370501980012173696',
      'Rukiye Aksoy',
      'spending' // Not savings, so transfer will be 'other' kind
    );
    // Spending account (source account)
    db.prepare(`INSERT OR IGNORE INTO accounts (id, iban, name, role) VALUES (?, ?, ?, ?)`).run(
      'spending-main',
      'DE12345678901234567890',
      'Main Spending Account',
      'spending'
    );
  });

  it('categorizes transfer to Aaron (savings IBAN) as internal transfer via full import pipeline', () => {
    const row: CanonicalRow = {
      bookingDate: '2025-09-15',
      valueDate: '2025-09-15',
      amountCents: -270000, // -2700 EUR
      currency: 'EUR',
      purpose: 'Übertrag / Überweisung | Empfänger: Aaron McIntoshKto/IBAN: DE32200411770270381700 BLZ/BIC: COBADEHD077 Ref. 5I2C21PU02U8S56E/42431',
      counterpartName: 'Aaron McIntosh',
      accountIban: 'DE12345678901234567890',
      counterpartyIban: 'DE32200411770270381700',
      accountId: 'spending-main',
      source: 'csv_bank',
      sourceProfile: 'comdirect',
    };

    const result = insertTransactions([row], db);
    expect(result.inserted).toBe(1);

    // Query the inserted transaction
    const inserted = db.prepare(`
      SELECT 
        category, category_source, category_rule_id,
        isInternalTransfer, internalTransferKind, internalTransferDirection,
        internalTransferGroupId
      FROM transactions
      WHERE amountCents = -270000
    `).get() as any;

    expect(inserted).toBeDefined();
    
    // Must be marked as internal transfer
    expect(inserted.isInternalTransfer).toBe(1);
    expect(inserted.internalTransferKind).toBe('savings');
    expect(inserted.internalTransferDirection).toBe('out');
    expect(inserted.internalTransferGroupId).toBeTruthy();
    
    // Category must be internal transfer category, NOT transport
    expect(inserted.category).toMatch(/^internal:transfer/);
    expect(inserted.category?.startsWith('transport')).toBe(false);
    expect(inserted.category_source).toBe('system');
    expect(inserted.category_rule_id).toMatch(/internal_transfer/);
  });

  it('categorizes transfer to Rukiye as internal transfer via full import pipeline', () => {
    const row: CanonicalRow = {
      bookingDate: '2025-09-16',
      valueDate: '2025-09-16',
      amountCents: -55600, // -556 EUR
      currency: 'EUR',
      purpose: 'Übertrag / Überweisung | Empfänger: Rukiye AksoyKto/IBAN: DE93370501980012173696 BLZ/BIC: COLSDE33XXX Ref. 9Q2C21PU3JKASIIY/1734',
      counterpartName: 'Rukiye Aksoy',
      accountIban: 'DE12345678901234567890',
      counterpartyIban: 'DE93370501980012173696',
      accountId: 'spending-main',
      source: 'csv_bank',
      sourceProfile: 'comdirect',
    };

    const result = insertTransactions([row], db);
    expect(result.inserted).toBe(1);

    // Query the inserted transaction
    const inserted = db.prepare(`
      SELECT 
        category, category_source, category_rule_id,
        isInternalTransfer, internalTransferKind, internalTransferDirection
      FROM transactions
      WHERE amountCents = -55600
    `).get() as any;

    expect(inserted).toBeDefined();
    
    // Should be marked as internal transfer (counterparty IBAN is in accounts table)
    // The matcher should detect it's between own accounts
    expect(inserted.isInternalTransfer).toBe(1);
    expect(inserted.internalTransferKind).toBe('other'); // Rukiye's account is 'spending', not 'savings'
    expect(inserted.internalTransferDirection).toBe('out');
    
    // Category must be internal transfer, NOT transport
    expect(inserted.category).toMatch(/^internal:transfer/);
    expect(inserted.category?.startsWith('transport')).toBe(false);
  });

  it('categorizes salary from AMORIA BOND as income:salary via full import pipeline', () => {
    const row: CanonicalRow = {
      bookingDate: '2025-09-30',
      valueDate: '2025-09-30',
      amountCents: 310100, // +3101 EUR
      currency: 'EUR',
      purpose: 'Übertrag / Überweisung | Auftraggeber: AMORIA BOND GMBH Buchungstext: Lohn / Gehalt 09/2025 Ref. AC2C21PT3OKI0AWJ/84479',
      counterpartName: 'AMORIA BOND GMBH',
      accountIban: 'DE12345678901234567890',
      counterpartyIban: null,
      accountId: 'spending-main',
      source: 'csv_bank',
      sourceProfile: 'comdirect',
    };

    const result = insertTransactions([row], db);
    expect(result.inserted).toBe(1);

    // Query the inserted transaction
    const inserted = db.prepare(`
      SELECT 
        category, category_source, category_rule_id, categoryConfidence,
        isInternalTransfer
      FROM transactions
      WHERE amountCents = 310100
    `).get() as any;

    expect(inserted).toBeDefined();
    
    // Must be income:salary (legacy mapping), NOT transport
    // Note: DB stores legacy category 'income_salary', but engine uses 'income:salary'
    expect(inserted.category).toBe('income_salary'); // Legacy category after mapping
    expect(inserted.category?.startsWith('transport')).toBe(false);
    expect(inserted.categoryConfidence).toBeGreaterThanOrEqual(0.85);
    expect(inserted.isInternalTransfer || 0).toBe(0); // Not an internal transfer
  });
});

