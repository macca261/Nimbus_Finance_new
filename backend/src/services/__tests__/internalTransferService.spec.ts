import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { NormalizedCanonicalRow } from '../../db';
import { detectInternalTransfer, detectPaymentProviderFunding } from '../internalTransferService';
import * as accountsService from '../accountsService';

describe('internalTransferService', () => {
  let db: BetterSqliteDatabase;

  beforeEach(() => {
    db = new BetterSqlite3(':memory:');
    db.exec(`
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        iban TEXT,
        accountNumber TEXT,
        isPrimary INTEGER DEFAULT 0,
        isArchived INTEGER DEFAULT 0,
        userId TEXT DEFAULT 'default',
        createdAt TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        updatedAt TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      );
    `);

    // Create test accounts (manually insert to control IDs)
    db.prepare(`
      INSERT INTO accounts (id, name, type, iban, accountNumber, userId, createdAt, updatedAt)
      VALUES ('acc1', 'Girokonto', 'CHECKING', 'DE89370400440532013000', '123456', 'default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();
    
    db.prepare(`
      INSERT INTO accounts (id, name, type, iban, accountNumber, userId, createdAt, updatedAt)
      VALUES ('acc2', 'Sparkonto', 'SAVINGS', 'DE89370400440532013001', '789012', 'default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  function createTransaction(overrides: Partial<NormalizedCanonicalRow>): NormalizedCanonicalRow {
    return {
      publicId: `tx-${Date.now()}-${Math.random()}`,
      bookingDate: '2025-01-15',
      valueDate: '2025-01-15',
      amountCents: -10000,
      currency: 'EUR',
      purpose: '',
      fingerprint: 'test',
      source: 'csv_bank',
      sourceProfile: null,
      accountId: 'acc1',
      createdAt: '2025-01-15T00:00:00Z',
      transactionPayload: {} as any,
      ...overrides,
    };
  }

  describe('detectInternalTransfer', () => {
    it('should detect transfer by IBAN match', () => {
      const tx = createTransaction({
        accountId: 'acc1',
        counterpartyIban: 'DE89370400440532013001', // acc2's IBAN
        amountCents: -10000,
      });

      const result = detectInternalTransfer(tx, db);

      expect(result.isInternalTransfer).toBe(true);
      expect(result.fromAccountId).toBe('acc1');
      expect(result.toAccountId).toBe('acc2');
      expect(result.kind).toBe('savings');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should detect transfer by account number match', () => {
      const tx = createTransaction({
        accountId: 'acc1',
        counterpartName: 'Konto 789012', // Contains acc2's account number
        amountCents: -10000,
      });

      const result = detectInternalTransfer(tx, db);

      expect(result.isInternalTransfer).toBe(true);
      expect(result.fromAccountId).toBe('acc1');
      expect(result.toAccountId).toBe('acc2');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should not detect transfer if same account', () => {
      const tx = createTransaction({
        accountId: 'acc1',
        counterpartyIban: 'DE89370400440532013000', // Same as acc1's IBAN
        amountCents: -10000,
      });

      const result = detectInternalTransfer(tx, db);

      // Should not detect because sourceAccountId === targetAccount.id
      expect(result.isInternalTransfer).toBe(false);
    });

    it('should not detect transfer for refunds', () => {
      const tx = createTransaction({
        accountId: 'acc1',
        counterpartyIban: 'DE89370400440532013001',
        isRefund: true,
        amountCents: -10000,
      });

      const result = detectInternalTransfer(tx, db);

      expect(result.isInternalTransfer).toBe(false);
      expect(result.reason).toContain('refund');
    });

    it('should detect paired transactions with matching amounts', () => {
      const tx1 = createTransaction({
        accountId: 'acc1',
        amountCents: -10000,
        bookingDate: '2025-01-15',
        purpose: 'Übertrag Sparkonto',
      });

      const tx2 = createTransaction({
        accountId: 'acc2',
        amountCents: 10000,
        bookingDate: '2025-01-15',
        purpose: 'Übertrag Girokonto',
      });

      const result = detectInternalTransfer(tx1, db, [tx2]);

      expect(result.isInternalTransfer).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should not detect transfer if dates are too far apart', () => {
      const tx1 = createTransaction({
        accountId: 'acc1',
        amountCents: -10000,
        bookingDate: '2025-01-15',
        purpose: 'Übertrag',
      });

      const tx2 = createTransaction({
        accountId: 'acc2',
        amountCents: 10000,
        bookingDate: '2025-01-20', // 5 days later (outside 3-day window)
        purpose: 'Übertrag',
      });

      const result = detectInternalTransfer(tx1, db, [tx2]);

      expect(result.isInternalTransfer).toBe(false);
    });

    it('should not detect transfer for external transactions', () => {
      const tx = createTransaction({
        accountId: 'acc1',
        counterpartyIban: 'DE99999999999999999999', // Not in accounts
        amountCents: -10000,
      });

      const result = detectInternalTransfer(tx, db);

      expect(result.isInternalTransfer).toBe(false);
    });
  });

  describe('detectPaymentProviderFunding', () => {
    beforeEach(() => {
      // Create transactions table
      db.exec(`
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          publicId TEXT UNIQUE,
          bookingDate TEXT NOT NULL,
          amountCents INTEGER NOT NULL,
          purpose TEXT,
          counterpartName TEXT,
          accountId TEXT,
          isInternalTransfer INTEGER DEFAULT 0,
          internalTransferKind TEXT,
          internalTransferDirection TEXT,
          internalTransferGroupId TEXT,
          fromAccountId TEXT,
          toAccountId TEXT,
          pairedTransactionId TEXT,
          createdAt TEXT DEFAULT (CURRENT_TIMESTAMP)
        );
      `);
    });

    it('should detect payment provider funding transfer', () => {
      // Create bank account and PayPal account
      db.prepare(`
        INSERT INTO accounts (id, name, type, userId, createdAt, updatedAt)
        VALUES ('bank-acc', 'Girokonto', 'CHECKING', 'default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run();
      
      db.prepare(`
        INSERT INTO accounts (id, name, type, userId, createdAt, updatedAt)
        VALUES ('paypal-acc', 'PayPal', 'PAYMENT_PROVIDER', 'default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run();

      // Insert bank transaction: bank → PayPal funding
      const bankTxId = db.prepare(`
        INSERT INTO transactions (publicId, bookingDate, amountCents, purpose, counterpartName, accountId, isInternalTransfer)
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `).run(
        'bank-tx-1',
        '2025-01-15',
        -5183, // -51.83 EUR
        'PayPal (Europe) S.a.r.l. et Cie',
        'PAYPAL',
        'bank-acc'
      ).lastInsertRowid;

      // Insert PayPal transaction: PayPal → merchant (same amount, same/near date)
      db.prepare(`
        INSERT INTO transactions (publicId, bookingDate, amountCents, purpose, counterpartName, accountId, isInternalTransfer)
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `).run(
        'paypal-tx-1',
        '2025-01-15',
        -5183, // Same amount
        'Amazon Marketplace',
        'AMAZON',
        'paypal-acc'
      );

      // Run detection
      const detected = detectPaymentProviderFunding(db, { windowDays: 2 });

      // Verify bank transaction was marked as internal transfer
      // Architectural purity: payment provider funding uses pairedTransactionId, not fromAccountId/toAccountId
      const bankTx = db.prepare(`
        SELECT isInternalTransfer, internalTransferKind, pairedTransactionId
        FROM transactions
        WHERE id = ?
      `).get(bankTxId) as {
        isInternalTransfer: number;
        internalTransferKind: string | null;
        pairedTransactionId: string | null;
      };

      expect(bankTx.isInternalTransfer).toBe(1);
      expect(bankTx.internalTransferKind).toBe('payment_provider_funding');
      // Verify pairedTransactionId links to the provider transaction
      expect(bankTx.pairedTransactionId).toBe('paypal-tx-1');

      // Verify PayPal transaction remains non-internal
      const paypalTx = db.prepare(`
        SELECT isInternalTransfer
        FROM transactions
        WHERE publicId = 'paypal-tx-1'
      `).get() as { isInternalTransfer: number };

      expect(paypalTx.isInternalTransfer).toBe(0);

      // Verify detection result
      expect(detected.length).toBe(1);
      expect(detected[0].kind).toBe('payment_provider_funding');
      expect(detected[0].pairedTransactionId).toBe('paypal-tx-1');
    });

    it('should not detect if no PayPal account exists', () => {
      // Create only bank account
      db.prepare(`
        INSERT INTO accounts (id, name, type, userId, createdAt, updatedAt)
        VALUES ('bank-acc', 'Girokonto', 'CHECKING', 'default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run();

      // Insert bank transaction with PayPal in description
      db.prepare(`
        INSERT INTO transactions (publicId, bookingDate, amountCents, purpose, accountId, isInternalTransfer)
        VALUES (?, ?, ?, ?, ?, 0)
      `).run(
        'bank-tx-1',
        '2025-01-15',
        -5183,
        'PayPal (Europe)',
        'bank-acc'
      );

      // Run detection
      const detected = detectPaymentProviderFunding(db, { windowDays: 2 });

      // Should not detect anything
      expect(detected.length).toBe(0);

      // Bank transaction should remain non-internal
      const bankTx = db.prepare(`
        SELECT isInternalTransfer
        FROM transactions
        WHERE publicId = 'bank-tx-1'
      `).get() as { isInternalTransfer: number };

      expect(bankTx.isInternalTransfer).toBe(0);
    });

    it('should not detect if multiple candidates exist (fail-safe)', () => {
      // Create bank account and PayPal account
      db.prepare(`
        INSERT INTO accounts (id, name, type, userId, createdAt, updatedAt)
        VALUES ('bank-acc', 'Girokonto', 'CHECKING', 'default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run();
      
      db.prepare(`
        INSERT INTO accounts (id, name, type, userId, createdAt, updatedAt)
        VALUES ('paypal-acc', 'PayPal', 'PAYMENT_PROVIDER', 'default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run();

      // Insert PayPal transaction
      db.prepare(`
        INSERT INTO transactions (publicId, bookingDate, amountCents, purpose, accountId, isInternalTransfer)
        VALUES (?, ?, ?, ?, ?, 0)
      `).run(
        'paypal-tx-1',
        '2025-01-15',
        -5183,
        'Amazon Marketplace',
        'paypal-acc'
      );

      // Insert TWO bank transactions with same amount and PayPal in description (ambiguous)
      db.prepare(`
        INSERT INTO transactions (publicId, bookingDate, amountCents, purpose, accountId, isInternalTransfer)
        VALUES (?, ?, ?, ?, ?, 0)
      `).run(
        'bank-tx-1',
        '2025-01-15',
        -5183,
        'PayPal (Europe)',
        'bank-acc'
      );

      db.prepare(`
        INSERT INTO transactions (publicId, bookingDate, amountCents, purpose, accountId, isInternalTransfer)
        VALUES (?, ?, ?, ?, ?, 0)
      `).run(
        'bank-tx-2',
        '2025-01-15',
        -5183,
        'PayPal Transfer',
        'bank-acc'
      );

      // Run detection
      const detected = detectPaymentProviderFunding(db, { windowDays: 2 });

      // Should not detect anything (multiple candidates)
      expect(detected.length).toBe(0);

      // Both bank transactions should remain non-internal
      const bankTx1 = db.prepare(`
        SELECT isInternalTransfer
        FROM transactions
        WHERE publicId = 'bank-tx-1'
      `).get() as { isInternalTransfer: number };

      const bankTx2 = db.prepare(`
        SELECT isInternalTransfer
        FROM transactions
        WHERE publicId = 'bank-tx-2'
      `).get() as { isInternalTransfer: number };

      expect(bankTx1.isInternalTransfer).toBe(0);
      expect(bankTx2.isInternalTransfer).toBe(0);
    });

    it('should not detect if dates are too far apart', () => {
      // Create bank account and PayPal account
      db.prepare(`
        INSERT INTO accounts (id, name, type, userId, createdAt, updatedAt)
        VALUES ('bank-acc', 'Girokonto', 'CHECKING', 'default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run();
      
      db.prepare(`
        INSERT INTO accounts (id, name, type, userId, createdAt, updatedAt)
        VALUES ('paypal-acc', 'PayPal', 'PAYMENT_PROVIDER', 'default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run();

      // Insert PayPal transaction
      db.prepare(`
        INSERT INTO transactions (publicId, bookingDate, amountCents, purpose, accountId, isInternalTransfer)
        VALUES (?, ?, ?, ?, ?, 0)
      `).run(
        'paypal-tx-1',
        '2025-01-15',
        -5183,
        'Amazon Marketplace',
        'paypal-acc'
      );

      // Insert bank transaction 5 days later (outside 2-day window)
      db.prepare(`
        INSERT INTO transactions (publicId, bookingDate, amountCents, purpose, accountId, isInternalTransfer)
        VALUES (?, ?, ?, ?, ?, 0)
      `).run(
        'bank-tx-1',
        '2025-01-20', // 5 days later
        -5183,
        'PayPal (Europe)',
        'bank-acc'
      );

      // Run detection
      const detected = detectPaymentProviderFunding(db, { windowDays: 2 });

      // Should not detect (dates too far apart)
      expect(detected.length).toBe(0);
    });

    it('should not re-detect already marked transactions', () => {
      // Create bank account and PayPal account
      db.prepare(`
        INSERT INTO accounts (id, name, type, userId, createdAt, updatedAt)
        VALUES ('bank-acc', 'Girokonto', 'CHECKING', 'default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run();
      
      db.prepare(`
        INSERT INTO accounts (id, name, type, userId, createdAt, updatedAt)
        VALUES ('paypal-acc', 'PayPal', 'PAYMENT_PROVIDER', 'default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run();

      // Insert bank transaction already marked as internal transfer
      db.prepare(`
        INSERT INTO transactions (publicId, bookingDate, amountCents, purpose, accountId, isInternalTransfer, internalTransferKind)
        VALUES (?, ?, ?, ?, ?, 1, 'payment_provider_funding')
      `).run(
        'bank-tx-1',
        '2025-01-15',
        -5183,
        'PayPal (Europe)',
        'bank-acc'
      );

      // Insert PayPal transaction
      db.prepare(`
        INSERT INTO transactions (publicId, bookingDate, amountCents, purpose, accountId, isInternalTransfer)
        VALUES (?, ?, ?, ?, ?, 0)
      `).run(
        'paypal-tx-1',
        '2025-01-15',
        -5183,
        'Amazon Marketplace',
        'paypal-acc'
      );

      // Run detection
      const detected = detectPaymentProviderFunding(db, { windowDays: 2 });

      // Should not detect (already marked)
      expect(detected.length).toBe(0);
    });

    it('should not detect if both accounts are non-payment-provider', () => {
      // Create two bank accounts (both CHECKING, neither is PAYMENT_PROVIDER)
      db.prepare(`
        INSERT INTO accounts (id, name, type, userId, createdAt, updatedAt)
        VALUES ('bank-acc-1', 'Girokonto 1', 'CHECKING', 'default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run();
      
      db.prepare(`
        INSERT INTO accounts (id, name, type, userId, createdAt, updatedAt)
        VALUES ('bank-acc-2', 'Girokonto 2', 'CHECKING', 'default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run();

      // Insert transaction on first bank account
      db.prepare(`
        INSERT INTO transactions (publicId, bookingDate, amountCents, purpose, accountId, isInternalTransfer)
        VALUES (?, ?, ?, ?, ?, 0)
      `).run(
        'bank-tx-1',
        '2025-01-15',
        -5183,
        'PayPal (Europe)',
        'bank-acc-1'
      );

      // Insert transaction on second bank account with same amount
      db.prepare(`
        INSERT INTO transactions (publicId, bookingDate, amountCents, purpose, accountId, isInternalTransfer)
        VALUES (?, ?, ?, ?, ?, 0)
      `).run(
        'bank-tx-2',
        '2025-01-15',
        -5183,
        'Amazon Marketplace',
        'bank-acc-2'
      );

      // Run detection
      const detected = detectPaymentProviderFunding(db, { windowDays: 2 });

      // Should not detect (both accounts are non-payment-provider)
      expect(detected.length).toBe(0);

      // Both transactions should remain non-internal
      const tx1 = db.prepare(`
        SELECT isInternalTransfer
        FROM transactions
        WHERE publicId = 'bank-tx-1'
      `).get() as { isInternalTransfer: number };

      const tx2 = db.prepare(`
        SELECT isInternalTransfer
        FROM transactions
        WHERE publicId = 'bank-tx-2'
      `).get() as { isInternalTransfer: number };

      expect(tx1.isInternalTransfer).toBe(0);
      expect(tx2.isInternalTransfer).toBe(0);
    });
  });
});

