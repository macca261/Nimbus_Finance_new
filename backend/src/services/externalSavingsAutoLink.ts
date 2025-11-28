/**
 * Auto-Link Logic for External Tracking Accounts
 * 
 * When the TCE detects an external savings transfer, this service:
 * 1. Checks if a tracking account exists with matching name
 * 2. Creates a new tracking account if not found
 * 3. Links the transaction to the account
 * 4. Retroactively scans and updates similar past transfers
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import { detectSavings } from './transactionCategorizationEngine';
import crypto from 'node:crypto';

export interface AutoLinkResult {
  accountId: string | null;
  accountCreated: boolean;
  transactionsUpdated: number;
}

/**
 * Auto-links a transaction to an external tracking account
 * 
 * @param db - Database connection
 * @param transaction - Transaction data
 * @returns Auto-link result
 */
export async function autoLinkExternalSavings(
  db: BetterSqliteDatabase,
  transaction: {
    publicId: string;
    payee: string | null;
    memo: string | null;
    amountCents: number;
    accountId: string | null;
  }
): Promise<AutoLinkResult | null> {
  // Check if this is an external savings transfer
  const categorization = detectSavings(transaction.payee, transaction.memo);
  
  if (!categorization.isExternalSavings) {
    return null;
  }

  // Extract potential account name from payee/memo
  const accountName = extractAccountName(transaction.payee, transaction.memo);
  
  if (!accountName) {
    return null;
  }

  // Check if tracking account already exists
  let accountId = findMatchingTrackingAccount(db, accountName);
  let accountCreated = false;

  if (!accountId) {
    // Create new tracking account
    accountId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO accounts (
        id, name, nature, type, institution_name, 
        current_balance_cents, createdAt, updatedAt
      ) VALUES (?, ?, 'TRACKING', 'INVESTMENT', ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(accountId, accountName, accountName);
    accountCreated = true;
  }

  // Update the transaction to mark it as external savings
  db.prepare(`
    UPDATE transactions
    SET is_external_savings = 1,
        accountId = COALESCE(accountId, ?)
    WHERE publicId = ?
  `).run(accountId, transaction.publicId);

  // Retroactively scan and update similar past transfers
  const transactionsUpdated = retroactivelyUpdateSimilarTransfers(db, accountName, accountId);

  return {
    accountId,
    accountCreated,
    transactionsUpdated,
  };
}

/**
 * Extracts account name from payee/memo
 */
function extractAccountName(payee: string | null, memo: string | null): string | null {
  const text = `${payee || ''} ${memo || ''}`.toUpperCase();
  
  // Common patterns
  const patterns = [
    /TRADE\s?REPUBLIC/i,
    /SCALABLE\s?CAPITAL/i,
    /FLATEX/i,
    /COMDIRECT/i,
    /BAADER\s?BANK/i,
    /LIQID/i,
    /QUIRION/i,
    /GINMON/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Normalize the name
      return match[0].replace(/\s+/g, ' ').trim();
    }
  }

  // Fallback: use payee if it looks like an institution name
  if (payee && payee.length > 3 && payee.length < 50) {
    return payee.trim();
  }

  return null;
}

/**
 * Finds a matching tracking account by name
 */
function findMatchingTrackingAccount(db: BetterSqliteDatabase, accountName: string): string | null {
  const normalized = accountName.toUpperCase().trim();
  
  const result = db.prepare(`
    SELECT id FROM accounts
    WHERE nature = 'TRACKING'
      AND (
        UPPER(name) LIKE ? 
        OR UPPER(institution_name) LIKE ?
      )
    LIMIT 1
  `).get(`%${normalized}%`, `%${normalized}%`) as { id: string } | undefined;

  return result?.id || null;
}

/**
 * Retroactively updates similar past transfers to link to the new account
 */
function retroactivelyUpdateSimilarTransfers(
  db: BetterSqliteDatabase,
  accountName: string,
  accountId: string
): number {
  const normalized = accountName.toUpperCase().trim();
  
  const result = db.prepare(`
    UPDATE transactions
    SET is_external_savings = 1,
        accountId = ?
    WHERE (
      UPPER(payee) LIKE ? 
      OR UPPER(memo) LIKE ?
    )
    AND is_external_savings = 0
    AND amountCents < 0
  `).run(accountId, `%${normalized}%`, `%${normalized}%`);

  return result.changes || 0;
}

