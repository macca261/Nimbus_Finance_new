import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import crypto from 'node:crypto';

export type AccountType = 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'CASH' | 'OTHER' | 'PAYMENT_PROVIDER';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  iban?: string | null;
  accountNumber?: string | null;
  isPrimary: boolean;
  isArchived: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  iban?: string | null;
  accountNumber?: string | null;
  isPrimary?: boolean;
}

export interface UpdateAccountInput {
  name?: string;
  type?: AccountType;
  iban?: string | null;
  accountNumber?: string | null;
  isPrimary?: boolean;
}

const DEFAULT_USER_ID = 'default';

/**
 * Validate account type enum.
 */
export function isValidAccountType(type: unknown): type is AccountType {
  return typeof type === 'string' && 
    ['CHECKING', 'SAVINGS', 'CREDIT_CARD', 'CASH', 'OTHER', 'PAYMENT_PROVIDER'].includes(type);
}

/**
 * Determine if an account should be typed as PAYMENT_PROVIDER based on name or import source.
 * This is used during account creation/update to automatically detect PayPal-style accounts.
 * 
 * @param name - Account name or displayName
 * @param importSource - Optional import source metadata (e.g., 'csv_paypal', 'paypal_api')
 * @returns true if account should be typed as PAYMENT_PROVIDER
 */
export function shouldBePaymentProviderAccount(name?: string | null, importSource?: string | null): boolean {
  if (!name) return false;
  
  const nameLower = name.toLowerCase().trim();
  
  // Check if name contains "paypal" (case-insensitive)
  if (/paypal/i.test(nameLower)) {
    return true;
  }
  
  // Check import source metadata
  if (importSource && /paypal/i.test(importSource)) {
    return true;
  }
  
  // Future: Add other payment providers (Klarna, Apple Pay, etc.)
  // if (/klarna/i.test(nameLower)) return true;
  // if (/apple\s*pay/i.test(nameLower)) return true;
  
  return false;
}

/**
 * List all accounts for a user (excluding archived by default).
 */
export function listAccounts(
  db: BetterSqliteDatabase,
  options: { includeArchived?: boolean; userId?: string } = {},
): Account[] {
  const userId = options.userId || DEFAULT_USER_ID;
  const includeArchived = options.includeArchived ?? false;
  
  // Check if accounts table exists and has required columns
  try {
    const tableInfo = db.prepare(`PRAGMA table_info('accounts')`).all() as Array<{ name: string }>;
    const hasAccountsTable = tableInfo.length > 0;
    if (!hasAccountsTable) {
      return []; // Table doesn't exist yet, return empty array
    }
  } catch {
    return []; // Error checking table, return empty array
  }
  
  const whereClause = includeArchived 
    ? 'WHERE userId = ?'
    : 'WHERE userId = ? AND (isArchived = 0 OR isArchived IS NULL)';
  
  try {
    const rows = db
      .prepare(`SELECT id, name, type, iban, accountNumber, isPrimary, isArchived, userId, createdAt, 
                       COALESCE(updatedAt, createdAt, CURRENT_TIMESTAMP) AS updatedAt
                FROM accounts 
                ${whereClause}
                ORDER BY isPrimary DESC, createdAt DESC`)
      .all(userId) as Array<{
        id: string;
        name: string;
        type: string;
        iban: string | null;
        accountNumber: string | null;
        isPrimary: number | null;
        isArchived: number | null;
        userId: string;
        createdAt: string;
        updatedAt: string;
      }>;

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      type: row.type as AccountType,
      iban: row.iban ?? null,
      accountNumber: row.accountNumber ?? null,
      isPrimary: Boolean(row.isPrimary),
      isArchived: Boolean(row.isArchived),
      userId: row.userId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  } catch (error: any) {
    // If query fails (e.g., missing columns), return empty array
    console.warn('[accountsService] listAccounts error:', error?.message);
    return [];
  }
}

/**
 * Get a single account by ID.
 */
export function getAccountById(
  db: BetterSqliteDatabase,
  accountId: string,
  userId?: string,
): Account | null {
  const uid = userId || DEFAULT_USER_ID;
  const row = db
    .prepare(`SELECT id, name, type, iban, accountNumber, isPrimary, isArchived, userId, createdAt, 
                     COALESCE(updatedAt, createdAt, CURRENT_TIMESTAMP) AS updatedAt
              FROM accounts 
              WHERE id = ? AND userId = ? AND (isArchived = 0 OR isArchived IS NULL)`)
    .get(accountId, uid) as {
      id: string;
      name: string;
      type: string;
      iban: string | null;
      accountNumber: string | null;
      isPrimary: number | null;
      isArchived: number | null;
      userId: string;
      createdAt: string;
      updatedAt: string;
    } | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    type: row.type as AccountType,
    iban: row.iban ?? null,
    accountNumber: row.accountNumber ?? null,
    isPrimary: Boolean(row.isPrimary),
    isArchived: Boolean(row.isArchived),
    userId: row.userId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Create a new account.
 */
export function createAccount(
  db: BetterSqliteDatabase,
  input: CreateAccountInput,
  userId?: string,
  importSource?: string | null,
): Account {
  const uid = userId || DEFAULT_USER_ID;
  
  // Validate input
  if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
    throw new Error('Account name is required');
  }
  
  // Auto-detect payment provider accounts if type not explicitly provided
  let accountType = input.type;
  if (!accountType || accountType === 'CHECKING') {
    if (shouldBePaymentProviderAccount(input.name, importSource)) {
      accountType = 'PAYMENT_PROVIDER';
    } else {
      accountType = accountType || 'CHECKING';
    }
  }
  
  if (!isValidAccountType(accountType)) {
    throw new Error(`Invalid account type: ${accountType}`);
  }

  // Generate ID
  const id = crypto.randomUUID();

  // If setting as primary, unset other primary accounts
  if (input.isPrimary) {
    db.prepare(`UPDATE accounts SET isPrimary = 0 WHERE userId = ? AND isPrimary = 1`)
      .run(uid);
  }

  // Insert account
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO accounts (id, name, type, iban, accountNumber, isPrimary, isArchived, userId, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.name.trim(),
    accountType, // Use auto-detected or provided type
    input.iban?.trim() || null,
    input.accountNumber?.trim() || null,
    input.isPrimary ? 1 : 0,
    0, // isArchived
    uid,
    now,
    now,
  );

  const account = getAccountById(db, id, uid);
  if (!account) {
    throw new Error('Failed to create account');
  }

  return account;
}

/**
 * Update an existing account.
 */
export function updateAccount(
  db: BetterSqliteDatabase,
  accountId: string,
  input: UpdateAccountInput,
  userId?: string,
): Account {
  const uid = userId || DEFAULT_USER_ID;
  
  // Check account exists
  const existing = getAccountById(db, accountId, uid);
  if (!existing) {
    throw new Error('Account not found');
  }

  // Validate type if provided
  if (input.type !== undefined && !isValidAccountType(input.type)) {
    throw new Error(`Invalid account type: ${input.type}`);
  }

  // Build update query
  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.name !== undefined) {
    if (typeof input.name !== 'string' || input.name.trim().length === 0) {
      throw new Error('Account name cannot be empty');
    }
    updates.push('name = ?');
    params.push(input.name.trim());
  }

  if (input.type !== undefined) {
    updates.push('type = ?');
    params.push(input.type);
  }

  if (input.iban !== undefined) {
    updates.push('iban = ?');
    params.push(input.iban?.trim() || null);
  }

  if (input.accountNumber !== undefined) {
    updates.push('accountNumber = ?');
    params.push(input.accountNumber?.trim() || null);
  }

  if (input.isPrimary !== undefined) {
    updates.push('isPrimary = ?');
    params.push(input.isPrimary ? 1 : 0);
    
    // If setting as primary, unset other primary accounts
    if (input.isPrimary) {
      db.prepare(`UPDATE accounts SET isPrimary = 0 WHERE userId = ? AND id != ? AND isPrimary = 1`)
        .run(uid, accountId);
    }
  }

  if (updates.length === 0) {
    return existing; // No changes
  }

  // Add updatedAt
  updates.push('updatedAt = ?');
  params.push(new Date().toISOString());

  // Add WHERE clause params
  params.push(accountId, uid);

  // Execute update
  const sql = `UPDATE accounts SET ${updates.join(', ')} WHERE id = ? AND userId = ?`;
  const result = db.prepare(sql).run(...params);

  if (result.changes === 0) {
    throw new Error('Account not found or update failed');
  }

  const updated = getAccountById(db, accountId, uid);
  if (!updated) {
    throw new Error('Failed to retrieve updated account');
  }

  return updated;
}

/**
 * Soft delete (archive) an account.
 */
export function deleteAccount(
  db: BetterSqliteDatabase,
  accountId: string,
  userId?: string,
): void {
  const uid = userId || DEFAULT_USER_ID;
  
  // Check account exists
  const existing = getAccountById(db, accountId, uid);
  if (!existing) {
    throw new Error('Account not found');
  }

  // Check if account has transactions (only if transactions table exists)
  let hasTransactions = false;
  try {
    const txCount = db
      .prepare(`SELECT COUNT(*) as count FROM transactions WHERE accountId = ?`)
      .get(accountId) as { count: number };
    hasTransactions = txCount.count > 0;
  } catch {
    // Transactions table doesn't exist (e.g., in tests), assume no transactions
    hasTransactions = false;
  }

  if (hasTransactions) {
    // Soft delete: archive instead of hard delete to preserve FK integrity
    db.prepare(`
      UPDATE accounts 
      SET isArchived = 1, updatedAt = ?
      WHERE id = ? AND userId = ?
    `).run(new Date().toISOString(), accountId, uid);
  } else {
    // Hard delete if no transactions (safe to remove)
    db.prepare(`DELETE FROM accounts WHERE id = ? AND userId = ?`).run(accountId, uid);
  }
}

/**
 * Get account by IBAN (for internal transfer detection).
 */
export function getAccountByIban(
  db: BetterSqliteDatabase,
  iban: string,
  userId?: string,
): Account | null {
  const uid = userId || DEFAULT_USER_ID;
  const normalizedIban = iban?.trim().toUpperCase().replace(/\s+/g, '') || '';
  
  if (!normalizedIban) {
    return null;
  }

  const row = db
    .prepare(`SELECT id, name, type, iban, accountNumber, isPrimary, isArchived, userId, createdAt, 
                     COALESCE(updatedAt, createdAt, CURRENT_TIMESTAMP) AS updatedAt
              FROM accounts 
              WHERE UPPER(REPLACE(iban, ' ', '')) = ? AND userId = ? AND (isArchived = 0 OR isArchived IS NULL)`)
    .get(normalizedIban, uid) as {
      id: string;
      name: string;
      type: string;
      iban: string | null;
      accountNumber: string | null;
      isPrimary: number | null;
      isArchived: number | null;
      userId: string;
      createdAt: string;
      updatedAt: string;
    } | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    type: row.type as AccountType,
    iban: row.iban ?? null,
    accountNumber: row.accountNumber ?? null,
    isPrimary: Boolean(row.isPrimary),
    isArchived: Boolean(row.isArchived),
    userId: row.userId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Get account by account number (for internal transfer detection).
 */
export function getAccountByAccountNumber(
  db: BetterSqliteDatabase,
  accountNumber: string,
  userId?: string,
): Account | null {
  const uid = userId || DEFAULT_USER_ID;
  const normalized = accountNumber?.trim() || '';
  
  if (!normalized) {
    return null;
  }

  const row = db
    .prepare(`SELECT id, name, type, iban, accountNumber, isPrimary, isArchived, userId, createdAt, 
                     COALESCE(updatedAt, createdAt, CURRENT_TIMESTAMP) AS updatedAt
              FROM accounts 
              WHERE accountNumber = ? AND userId = ? AND (isArchived = 0 OR isArchived IS NULL)`)
    .get(normalized, uid) as {
      id: string;
      name: string;
      type: string;
      iban: string | null;
      accountNumber: string | null;
      isPrimary: number | null;
      isArchived: number | null;
      userId: string;
      createdAt: string;
      updatedAt: string;
    } | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    type: row.type as AccountType,
    iban: row.iban ?? null,
    accountNumber: row.accountNumber ?? null,
    isPrimary: Boolean(row.isPrimary),
    isArchived: Boolean(row.isArchived),
    userId: row.userId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

