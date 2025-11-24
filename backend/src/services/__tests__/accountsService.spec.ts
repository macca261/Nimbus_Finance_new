import { describe, it, expect, beforeEach } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import * as accountsService from '../accountsService';

describe('accountsService', () => {
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
  });

  afterEach(() => {
    db.close();
  });

  describe('createAccount', () => {
    it('should create an account with required fields', () => {
      const account = accountsService.createAccount(db, {
        name: 'Test Konto',
        type: 'CHECKING',
      });

      expect(account.id).toBeTruthy();
      expect(account.name).toBe('Test Konto');
      expect(account.type).toBe('CHECKING');
      expect(account.isPrimary).toBe(false);
      expect(account.isArchived).toBe(false);
    });

    it('should create an account with all fields', () => {
      const account = accountsService.createAccount(db, {
        name: 'Sparkonto',
        type: 'SAVINGS',
        iban: 'DE89370400440532013000',
        accountNumber: '123456789',
        isPrimary: true,
      });

      expect(account.name).toBe('Sparkonto');
      expect(account.type).toBe('SAVINGS');
      expect(account.iban).toBe('DE89370400440532013000');
      expect(account.accountNumber).toBe('123456789');
      expect(account.isPrimary).toBe(true);
    });

    it('should unset other primary accounts when setting one as primary', () => {
      const acc1 = accountsService.createAccount(db, {
        name: 'Konto 1',
        type: 'CHECKING',
        isPrimary: true,
      });

      const acc2 = accountsService.createAccount(db, {
        name: 'Konto 2',
        type: 'CHECKING',
        isPrimary: true,
      });

      const updated1 = accountsService.getAccountById(db, acc1.id);
      expect(updated1?.isPrimary).toBe(false);
      expect(acc2.isPrimary).toBe(true);
    });

    it('should throw error for invalid account type', () => {
      expect(() => {
        accountsService.createAccount(db, {
          name: 'Test',
          type: 'INVALID' as any,
        });
      }).toThrow('Invalid account type');
    });

    it('should throw error for empty name', () => {
      expect(() => {
        accountsService.createAccount(db, {
          name: '',
          type: 'CHECKING',
        });
      }).toThrow('Account name is required');
    });
  });

  describe('updateAccount', () => {
    it('should update account name', () => {
      const account = accountsService.createAccount(db, {
        name: 'Old Name',
        type: 'CHECKING',
      });

      const updated = accountsService.updateAccount(db, account.id, {
        name: 'New Name',
      });

      expect(updated.name).toBe('New Name');
      expect(updated.type).toBe('CHECKING'); // Unchanged
    });

    it('should update account type', () => {
      const account = accountsService.createAccount(db, {
        name: 'Test',
        type: 'CHECKING',
      });

      const updated = accountsService.updateAccount(db, account.id, {
        type: 'SAVINGS',
      });

      expect(updated.type).toBe('SAVINGS');
    });

    it('should throw error if account not found', () => {
      expect(() => {
        accountsService.updateAccount(db, 'nonexistent', {
          name: 'New Name',
        });
      }).toThrow('Account not found');
    });
  });

  describe('deleteAccount', () => {
    it('should soft delete account with transactions', () => {
      const account = accountsService.createAccount(db, {
        name: 'Test',
        type: 'CHECKING',
      });

      // Simulate transactions by inserting into transactions table
      db.exec(`
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY,
          accountId TEXT,
          amountCents INTEGER
        );
      `);
      db.prepare(`INSERT INTO transactions (accountId, amountCents) VALUES (?, ?)`).run(account.id, 1000);

      accountsService.deleteAccount(db, account.id);

      // getAccountById should not return archived accounts
      const deleted = accountsService.getAccountById(db, account.id);
      expect(deleted).toBeNull();

      // But listAccounts with includeArchived should show it
      const archived = accountsService.listAccounts(db, { includeArchived: true });
      const archivedAccount = archived.find(a => a.id === account.id);
      expect(archivedAccount).toBeTruthy();
      expect(archivedAccount?.isArchived).toBe(true);
    });

    it('should hard delete account without transactions', () => {
      const account = accountsService.createAccount(db, {
        name: 'Test',
        type: 'CHECKING',
      });

      // No transactions table, so it should hard delete
      accountsService.deleteAccount(db, account.id);

      const deleted = accountsService.getAccountById(db, account.id);
      expect(deleted).toBeNull();
      
      const allAccounts = accountsService.listAccounts(db, { includeArchived: true });
      expect(allAccounts.find(a => a.id === account.id)).toBeUndefined();
    });
  });

  describe('getAccountByIban', () => {
    it('should find account by IBAN', () => {
      const iban = 'DE89370400440532013000';
      accountsService.createAccount(db, {
        name: 'Test',
        type: 'CHECKING',
        iban,
      });

      const found = accountsService.getAccountByIban(db, iban);
      expect(found).toBeTruthy();
      expect(found?.iban).toBe(iban);
    });

    it('should normalize IBAN (remove spaces, uppercase)', () => {
      const iban = 'DE89370400440532013000';
      accountsService.createAccount(db, {
        name: 'Test',
        type: 'CHECKING',
        iban,
      });

      const found = accountsService.getAccountByIban(db, 'de89 3704 0044 0532 0130 00');
      expect(found).toBeTruthy();
    });

    it('should return null if IBAN not found', () => {
      const found = accountsService.getAccountByIban(db, 'DE99999999999999999999');
      expect(found).toBeNull();
    });
  });

  describe('listAccounts', () => {
    it('should list all non-archived accounts by default', () => {
      const active = accountsService.createAccount(db, { name: 'Active', type: 'CHECKING' });
      const toArchive = accountsService.createAccount(db, { name: 'Archived', type: 'CHECKING' });
      
      // Manually archive (since deleteAccount requires transactions table)
      accountsService.updateAccount(db, toArchive.id, { isPrimary: false });
      db.prepare(`UPDATE accounts SET isArchived = 1 WHERE id = ?`).run(toArchive.id);

      const accounts = accountsService.listAccounts(db);
      expect(accounts.length).toBe(1);
      expect(accounts[0].name).toBe('Active');
    });

    it('should include archived accounts when requested', () => {
      const active = accountsService.createAccount(db, { name: 'Active', type: 'CHECKING' });
      const toArchive = accountsService.createAccount(db, { name: 'Archived', type: 'CHECKING' });
      
      // Manually archive
      db.prepare(`UPDATE accounts SET isArchived = 1 WHERE id = ?`).run(toArchive.id);

      const accounts = accountsService.listAccounts(db, { includeArchived: true });
      expect(accounts.length).toBe(2);
    });
  });
});

