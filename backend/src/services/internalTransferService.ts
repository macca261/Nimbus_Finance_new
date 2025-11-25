import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { IDatabase } from '../db/IDatabase';
import type { NormalizedCanonicalRow } from '../db';
import * as accountsService from './accountsService';

export interface InternalTransferDetectionResult {
  isInternalTransfer: boolean;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  kind?: 'savings' | 'wallet' | 'other' | 'payment_provider_funding';
  confidence: number; // 0-1, how confident we are this is an internal transfer
  reason?: string;
}

/**
 * Detect if a transaction is an internal transfer between user's own accounts.
 * 
 * Detection strategies (in priority order):
 * 1. IBAN matching: counterpartyIban matches an account's IBAN
 * 2. Account number matching: counterparty name/account number matches an account
 * 3. Account ID matching: transaction's accountId differs from counterparty account
 * 4. Keyword + amount pairing: existing internalTransferMatcher logic
 * 
 * @param transaction - The transaction to check
 * @param db - Database connection
 * @param allTransactions - Optional: all transactions for pairing detection
 * @returns Detection result with confidence and account IDs
 */
export function detectInternalTransfer(
  transaction: NormalizedCanonicalRow,
  db: BetterSqliteDatabase,
  allTransactions?: NormalizedCanonicalRow[],
): InternalTransferDetectionResult {
  try {
    // Skip if already marked as internal transfer
    if (transaction.isInternalTransfer) {
      return {
        isInternalTransfer: true,
        fromAccountId: transaction.accountId || null,
        toAccountId: null, // Would need pairing to determine
        kind: transaction.internalTransferKind || 'other',
        confidence: 1.0,
        reason: 'Already marked as internal transfer',
      };
    }

    // Skip refunds and reimbursements (they have their own logic)
    if (transaction.isRefund || transaction.isRefunded || transaction.refundGroupId) {
      return {
        isInternalTransfer: false,
        confidence: 0,
        reason: 'Transaction is a refund/reimbursement',
      };
    }
  } catch (error: any) {
    // If basic checks fail, return safe default
    return {
      isInternalTransfer: false,
      confidence: 0,
      reason: `Error in basic checks: ${error?.message || 'Unknown error'}`,
    };
  }

  try {
    // Strategy 1: IBAN matching (highest confidence)
    if (transaction.counterpartyIban) {
      const normalizedIban = transaction.counterpartyIban.trim().toUpperCase().replace(/\s+/g, '');
      let targetAccount: ReturnType<typeof accountsService.getAccountByIban> | null = null;
      try {
        targetAccount = accountsService.getAccountByIban(db, normalizedIban);
      } catch (error: any) {
        // If account lookup fails, log and continue
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[internalTransferService] getAccountByIban error', {
            iban: normalizedIban,
            error: error?.message || String(error),
          });
        }
      }
      
      if (targetAccount && !targetAccount.isArchived) {
        // Check if this is between different accounts
        const sourceAccountId = transaction.accountId;
        if (sourceAccountId && sourceAccountId !== targetAccount.id) {
          // Determine kind based on account types
          let kind: 'savings' | 'wallet' | 'other' = 'other';
          if (targetAccount.type === 'SAVINGS') {
            kind = 'savings';
          } else if (targetAccount.type === 'CASH') {
            kind = 'wallet';
          }

          return {
            isInternalTransfer: true,
            fromAccountId: sourceAccountId,
            toAccountId: targetAccount.id,
            kind,
            confidence: 0.95,
            reason: `IBAN match: ${targetAccount.name}`,
          };
        }
      }
    }
  } catch (error: any) {
    // If IBAN matching fails, continue to next strategy
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[internalTransferService] IBAN matching error', {
        error: error?.message || String(error),
      });
    }
  }

  // Strategy 2: Account number matching (medium confidence)
  try {
    if (transaction.counterpartName) {
      const counterpartText = transaction.counterpartName.trim();
      
      // Try to find account by account number
      let accounts: ReturnType<typeof accountsService.listAccounts> = [];
      try {
        accounts = accountsService.listAccounts(db, { includeArchived: false });
      } catch (error: any) {
        // If listAccounts fails, continue without account matching
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[internalTransferService] listAccounts error in account number matching', {
            error: error?.message || String(error),
          });
        }
      }
      
      for (const account of accounts) {
        if (account.accountNumber && counterpartText.includes(account.accountNumber)) {
          const sourceAccountId = transaction.accountId;
          if (sourceAccountId && sourceAccountId !== account.id) {
            let kind: 'savings' | 'wallet' | 'other' = 'other';
            if (account.type === 'SAVINGS') {
              kind = 'savings';
            } else if (account.type === 'CASH') {
              kind = 'wallet';
            }

            return {
              isInternalTransfer: true,
              fromAccountId: sourceAccountId,
              toAccountId: account.id,
              kind,
              confidence: 0.85,
              reason: `Account number match: ${account.name}`,
            };
          }
        }
      }
    }
  } catch (error: any) {
    // If account number matching fails, continue to next strategy
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[internalTransferService] account number matching error', {
        error: error?.message || String(error),
      });
    }
  }

  // Strategy 3: Account name matching in counterparty text (lower confidence)
  try {
    if (transaction.counterpartName || transaction.purpose) {
      const searchText = `${transaction.counterpartName || ''} ${transaction.purpose || ''}`.toLowerCase();
      let accounts: ReturnType<typeof accountsService.listAccounts> = [];
      try {
        accounts = accountsService.listAccounts(db, { includeArchived: false });
      } catch (error: any) {
        // If listAccounts fails, continue without account matching
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[internalTransferService] listAccounts error in account name matching', {
            error: error?.message || String(error),
          });
        }
      }
      
      for (const account of accounts) {
        if (account.name && searchText.includes(account.name.toLowerCase())) {
          const sourceAccountId = transaction.accountId;
          if (sourceAccountId && sourceAccountId !== account.id) {
            // Check for transfer keywords to increase confidence
            const hasTransferKeywords = /(überweisung|transfer|übertrag|sparen|tagesgeld)/i.test(searchText);
            
            if (hasTransferKeywords) {
              let kind: 'savings' | 'wallet' | 'other' = 'other';
              if (account.type === 'SAVINGS') {
                kind = 'savings';
              } else if (account.type === 'CASH') {
                kind = 'wallet';
              }

              return {
                isInternalTransfer: true,
                fromAccountId: sourceAccountId,
                toAccountId: account.id,
                kind,
                confidence: 0.75,
                reason: `Account name match with transfer keywords: ${account.name}`,
              };
            }
          }
        }
      }
    }
  } catch (error: any) {
    // If account name matching fails, continue to next strategy
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[internalTransferService] account name matching error', {
        error: error?.message || String(error),
      });
    }
  }

  // Strategy 4: Pairing detection (if allTransactions provided)
  // This uses the existing internalTransferMatcher logic but with account context
  if (allTransactions && allTransactions.length > 0) {
    const sourceAccountId = transaction.accountId;
    if (sourceAccountId) {
      // Find potential pair: same amount, opposite sign, within date window
      const amount = Math.abs(transaction.amountCents);
      const candidateDate = new Date(transaction.bookingDate);
      const daysWindow = 3;

      for (const other of allTransactions) {
        // Skip if same account
        if (!other.accountId || other.accountId === sourceAccountId) {
          continue;
        }

        // Check amount match
        if (Math.abs(other.amountCents) !== amount) {
          continue;
        }

        // Check opposite sign
        if ((transaction.amountCents < 0 && other.amountCents < 0) ||
            (transaction.amountCents > 0 && other.amountCents > 0)) {
          continue;
        }

        // Check date window
        const otherDate = new Date(other.bookingDate);
        const daysDiff = Math.abs((candidateDate.getTime() - otherDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > daysWindow) {
          continue;
        }

        // Check for transfer keywords
        const combinedText = `${transaction.counterpartName || ''} ${transaction.purpose || ''} ${other.counterpartName || ''} ${other.purpose || ''}`.toUpperCase();
        const hasKeywords = /(ÜBERTRAG|TRANSFER|ÜBERWEISUNG|SPAREN|TAGESGELD)/i.test(combinedText);

        if (hasKeywords) {
          // Get account types to determine kind
          let sourceAccount: ReturnType<typeof accountsService.getAccountById> | null = null;
          let targetAccount: ReturnType<typeof accountsService.getAccountById> | null = null;
          try {
            sourceAccount = accountsService.getAccountById(db, sourceAccountId);
            targetAccount = accountsService.getAccountById(db, other.accountId);
          } catch (error: any) {
            // If account lookup fails, continue with default kind
            if (process.env.NODE_ENV !== 'production') {
              console.warn('[internalTransferService] getAccountById error in pairing', {
                error: error?.message || String(error),
              });
            }
          }
          
          let kind: 'savings' | 'wallet' | 'other' = 'other';
          if (sourceAccount && targetAccount) {
            if (sourceAccount.type === 'SAVINGS' || targetAccount.type === 'SAVINGS') {
              kind = 'savings';
            } else if (sourceAccount.type === 'CASH' || targetAccount.type === 'CASH') {
              kind = 'wallet';
            }
          }

          return {
            isInternalTransfer: true,
            fromAccountId: transaction.amountCents < 0 ? sourceAccountId : other.accountId,
            toAccountId: transaction.amountCents < 0 ? other.accountId : sourceAccountId,
            kind,
            confidence: 0.8,
            reason: 'Paired transaction with matching amount and transfer keywords',
          };
        }
      }
    }
  }

  // No match found
  return {
    isInternalTransfer: false,
    confidence: 0,
    reason: 'No internal transfer indicators found',
  };
}

/**
 * Apply internal transfer detection to a batch of transactions.
 * This is more efficient than calling detectInternalTransfer individually.
 */
export function detectInternalTransfersBatch(
  transactions: NormalizedCanonicalRow[],
  db: BetterSqliteDatabase,
): Map<string, InternalTransferDetectionResult> {
  const results = new Map<string, InternalTransferDetectionResult>();
  
  // Safely get accounts - if it fails, continue without account-based detection
  let accounts: ReturnType<typeof accountsService.listAccounts> = [];
  try {
    accounts = accountsService.listAccounts(db, { includeArchived: false });
  } catch (error: any) {
    // If listAccounts fails, log and continue without account matching
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[internalTransferService] detectInternalTransfersBatch: listAccounts error', {
        error: error?.message || String(error),
      });
    }
    // Return empty results - transactions will be processed as normal
    return results;
  }
  
  // Build lookup maps for efficiency
  const accountsByIban = new Map<string, accountsService.Account>();
  const accountsById = new Map<string, accountsService.Account>();
  
  for (const account of accounts) {
    if (account.iban) {
      const normalized = account.iban.trim().toUpperCase().replace(/\s+/g, '');
      accountsByIban.set(normalized, account);
    }
    accountsById.set(account.id, account);
  }

  // First pass: IBAN and account number matching
  for (const tx of transactions) {
    if (tx.isInternalTransfer || tx.isRefund || tx.isRefunded) {
      continue; // Skip already processed
    }

    // IBAN match
    if (tx.counterpartyIban) {
      const normalized = tx.counterpartyIban.trim().toUpperCase().replace(/\s+/g, '');
      const targetAccount = accountsByIban.get(normalized);
      
      if (targetAccount && tx.accountId && tx.accountId !== targetAccount.id) {
        let kind: 'savings' | 'wallet' | 'other' = 'other';
        if (targetAccount.type === 'SAVINGS') kind = 'savings';
        else if (targetAccount.type === 'CASH') kind = 'wallet';

        results.set(tx.publicId || String(tx.id), {
          isInternalTransfer: true,
          fromAccountId: tx.accountId,
          toAccountId: targetAccount.id,
          kind,
          confidence: 0.95,
          reason: `IBAN match: ${targetAccount.name}`,
        });
        continue;
      }
    }

    // Account number match
    if (tx.counterpartName) {
      for (const account of accounts) {
        if (account.accountNumber && tx.counterpartName.includes(account.accountNumber)) {
          if (tx.accountId && tx.accountId !== account.id) {
            let kind: 'savings' | 'wallet' | 'other' = 'other';
            if (account.type === 'SAVINGS') kind = 'savings';
            else if (account.type === 'CASH') kind = 'wallet';

            results.set(tx.publicId || String(tx.id), {
              isInternalTransfer: true,
              fromAccountId: tx.accountId,
              toAccountId: account.id,
              kind,
              confidence: 0.85,
              reason: `Account number match: ${account.name}`,
            });
            break;
          }
        }
      }
    }
  }

  // Second pass: pairing detection for unmatched transactions
  const unmatched = transactions.filter(tx => 
    !results.has(tx.publicId || String(tx.id)) && 
    !tx.isInternalTransfer && 
    !tx.isRefund && 
    !tx.isRefunded
  );

  for (const tx of unmatched) {
    try {
      const result = detectInternalTransfer(tx, db, transactions);
      if (result.isInternalTransfer) {
        results.set(tx.publicId || String(tx.id), result);
      }
    } catch (error: any) {
      // If detection fails for a transaction, log and continue
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[internalTransferService] detectInternalTransfer error for transaction', {
          publicId: tx.publicId,
          error: error?.message || String(error),
        });
      }
      // Continue processing other transactions
    }
  }

  return results;
}

/**
 * Payment provider configuration for detecting funding transfers.
 * This allows us to extend support for other providers (Klarna, Apple Pay, etc.) in the future.
 */
export interface PaymentProviderConfig {
  key: string;                 // e.g. 'paypal'
  namePattern: RegExp;         // matches provider name in booking descriptions
}

const PAYMENT_PROVIDERS: PaymentProviderConfig[] = [
  { key: 'paypal', namePattern: /paypal/i },
  // TODO optional enhancement: Add Klarna, Apple Pay, etc.
  // { key: 'klarna', namePattern: /klarna/i },
  // { key: 'apple_pay', namePattern: /apple\s*pay/i },
];

/**
 * Detected transfer result for payment provider funding.
 */
export interface DetectedTransfer {
  transactionId: string;
  pairedTransactionId: string; // Links to the provider transaction (the actual expense)
  kind: 'payment_provider_funding';
  confidence: number;
  reason: string;
}

/**
 * Detect payment provider funding transfers.
 * 
 * INVARIANT: For payment providers, for each matched pair of [bank, provider] legs with same amount/date,
 * only the bank leg is marked isInternalTransfer = 1, kind = 'payment_provider_funding'.
 * The provider leg remains the canonical expense.
 * 
 * Algorithm (account-type driven & deterministic):
 * 1. Get all payment provider accounts (type === 'PAYMENT_PROVIDER').
 * 2. For each payment provider pattern (e.g., PayPal):
 *    a. Find bank transactions (non-payment-provider accounts) that mention the provider in description.
 *    b. For each bank transaction candidate:
 *       - Find provider transactions with matching absolute amount and date within window.
 *       - If exactly one provider candidate exists:
 *         * Mark the BANK transaction as internal transfer (isInternalTransfer = 1, kind = 'payment_provider_funding').
 *         * Leave the PROVIDER transaction as a normal expense (do NOT set isInternalTransfer).
 *       - If multiple candidates exist, skip to avoid mispairing.
 * 
 * @param db - Database connection
 * @param opts - Options including windowDays (default: 2)
 * @returns Array of detected transfers
 */
/**
 * Detect payment provider funding transfers.
 * 
 * Refactored to use IDatabase abstraction for future database backend support.
 */
export function detectPaymentProviderFunding(
  db: IDatabase,
  opts: { windowDays?: number } = {},
): DetectedTransfer[] {
  const windowDays = opts.windowDays ?? 2;
  const detected: DetectedTransfer[] = [];
  const isDev = process.env.NODE_ENV !== 'production';
  
  try {
    // Get all payment provider accounts (source of truth: account type)
    const paymentProviderAccounts = accountsService.listAccounts(db, { includeArchived: false })
      .filter(acc => acc.type === 'PAYMENT_PROVIDER');
    
    if (paymentProviderAccounts.length === 0) {
      if (isDev) {
        console.log('[internalTransfer] No payment provider accounts found, skipping detection');
      }
      return detected;
    }
    
    const paymentProviderAccountIds = new Set(paymentProviderAccounts.map(acc => acc.id));
    const paymentProviderAccountIdsArray = Array.from(paymentProviderAccountIds);
    
    if (isDev) {
      console.log('[internalTransfer] Payment provider accounts:', paymentProviderAccounts.map(a => `${a.name} (${a.id})`));
    }
    
    // For each payment provider pattern, find bank transactions that mention it
    for (const provider of PAYMENT_PROVIDERS) {
      const providerNamePattern = provider.key === 'paypal' ? '%PAYPAL%' : `%${provider.key.toUpperCase()}%`;
      
      // Find bank transactions (on non-payment-provider accounts) that mention the provider
      // These are potential funding transactions
      const bankTransactionsQuery = paymentProviderAccountIds.size > 0
        ? `
          SELECT 
            t.id,
            t.publicId,
            t.accountId,
            t.bookingDate,
            t.amountCents,
            t.purpose,
            t.counterpartName,
            t.isInternalTransfer,
            a.type as accountType
          FROM transactions t
          JOIN accounts a ON t.accountId = a.id
          WHERE t.accountId NOT IN (${paymentProviderAccountIdsArray.map(() => '?').join(',')})
            AND t.amountCents < 0
            AND (t.isInternalTransfer = 0 OR t.isInternalTransfer IS NULL)
            AND (UPPER(t.purpose || '') LIKE UPPER(?) OR UPPER(t.counterpartName || '') LIKE UPPER(?))
          ORDER BY t.bookingDate DESC
        `
        : `
          SELECT 
            t.id,
            t.publicId,
            t.accountId,
            t.bookingDate,
            t.amountCents,
            t.purpose,
            t.counterpartName,
            t.isInternalTransfer,
            a.type as accountType
          FROM transactions t
          JOIN accounts a ON t.accountId = a.id
          WHERE t.amountCents < 0
            AND (t.isInternalTransfer = 0 OR t.isInternalTransfer IS NULL)
            AND (UPPER(t.purpose || '') LIKE UPPER(?) OR UPPER(t.counterpartName || '') LIKE UPPER(?))
          ORDER BY t.bookingDate DESC
        `;
      
      const queryParams = paymentProviderAccountIds.size > 0
        ? [...paymentProviderAccountIdsArray, providerNamePattern, providerNamePattern]
        : [providerNamePattern, providerNamePattern];
      
      const bankTransactions = db.query<{
        id: number;
        publicId: string;
        accountId: string;
        bookingDate: string;
        amountCents: number;
        purpose: string | null;
        counterpartName: string | null;
        isInternalTransfer: number | null;
        accountType: string;
      }>;
      
      // Filter to ensure they match the provider pattern (double-check with regex for robustness)
      // GDPR GUARDRAIL: PII matching is confined to this backend service. Raw descriptions are never logged or exposed unnecessarily.
      const validBankTxs = bankTransactions.filter(bankTx => {
        const bankText = `${bankTx.purpose || ''} ${bankTx.counterpartName || ''}`.toLowerCase();
        return provider.namePattern.test(bankText);
      });
      
      if (isDev && validBankTxs.length > 0) {
        console.log(`[internalTransfer] Found ${validBankTxs.length} bank transactions mentioning ${provider.key}`);
      }
      
      // For each valid bank transaction, find matching provider transaction
      for (const bankTx of validBankTxs) {
        const amountAbs = Math.abs(bankTx.amountCents);
        const bankDate = new Date(bankTx.bookingDate);
        const dateFrom = new Date(bankDate);
        dateFrom.setDate(dateFrom.getDate() - windowDays);
        const dateTo = new Date(bankDate);
        dateTo.setDate(dateTo.getDate() + windowDays);
        
        // Find provider transactions with same absolute amount and within date window
        // These are the actual expenses (provider → merchant)
        const providerCandidatesQuery = paymentProviderAccountIds.size > 0
          ? `
            SELECT 
              id,
              publicId,
              accountId,
              bookingDate,
              amountCents,
              isInternalTransfer
            FROM transactions
            WHERE accountId IN (${paymentProviderAccountIdsArray.map(() => '?').join(',')})
              AND ABS(amountCents) = ?
              AND bookingDate >= ?
              AND bookingDate <= ?
              AND (isInternalTransfer = 0 OR isInternalTransfer IS NULL)
            ORDER BY ABS(JULIANDAY(bookingDate) - JULIANDAY(?)) ASC
          `
          : 'SELECT NULL WHERE 1=0'; // No payment provider accounts, no candidates
        
        const providerCandidates = paymentProviderAccountIds.size > 0
          ? db.query<{
              id: number;
              publicId: string;
              accountId: string;
              bookingDate: string;
              amountCents: number;
              isInternalTransfer: number | null;
            }>(
              providerCandidatesQuery,
              [
                ...paymentProviderAccountIdsArray,
                amountAbs, // Match absolute amount
                dateFrom.toISOString().slice(0, 10),
                dateTo.toISOString().slice(0, 10),
                bankTx.bookingDate,
              ]
            )
          : [];
        
        // Only proceed if exactly one provider candidate (fail-safe: avoid mispairing)
        if (providerCandidates.length === 1) {
          const providerTx = providerCandidates[0];
          
          // CRITICAL: Mark the BANK transaction as internal transfer
          // The provider transaction remains a normal expense
          // Architectural purity: Use pairedTransactionId to link the two legs, reserving fromAccountId/toAccountId
          // for true user-initiated transfers between accounts
          const providerTxPublicId = providerTx.publicId || String(providerTx.id);
          db.execute(`
            UPDATE transactions
            SET 
              isInternalTransfer = 1,
              pairedTransactionId = ?,
              internalTransferKind = 'payment_provider_funding',
              internalTransferDirection = 'out',
              internalTransferGroupId = ?
            WHERE id = ?
          `, [
            providerTxPublicId,
            `pp_${bankTx.accountId}_${providerTx.accountId}`,
            bankTx.id,
          ]);
          
          detected.push({
            transactionId: bankTx.publicId || String(bankTx.id),
            pairedTransactionId: providerTxPublicId,
            kind: 'payment_provider_funding',
            confidence: 0.9,
            reason: `Payment provider funding: ${provider.key} (amount: ${amountAbs / 100} EUR)`,
          });
          
          // Log in dev mode only
          if (isDev) {
            console.log('[internalTransfer] ✓ Marked bank tx as payment_provider_funding', {
              bankTxId: bankTx.id,
              bankTxPublicId: bankTx.publicId,
              bankAccountId: bankTx.accountId,
              bankAccountType: bankTx.accountType,
              providerTxId: providerTx.id,
              providerTxPublicId: providerTx.publicId,
              providerAccountId: providerTx.accountId,
              amount: amountAbs / 100,
              provider: provider.key,
              bankDate: bankTx.bookingDate,
              providerDate: providerTx.bookingDate,
            });
          }
        } else if (providerCandidates.length > 1) {
          // Multiple provider candidates - skip to avoid mispairing
          if (isDev) {
            console.warn('[internalTransfer] ⚠ Multiple provider candidates for payment provider funding, skipping', {
              bankTxId: bankTx.id,
              bankTxPublicId: bankTx.publicId,
              candidateCount: providerCandidates.length,
              amount: amountAbs / 100,
              provider: provider.key,
            });
          }
        } else if (providerCandidates.length === 0 && isDev) {
          // No matching provider transaction found
          console.log('[internalTransfer] No matching provider transaction for bank tx', {
            bankTxId: bankTx.id,
            amount: amountAbs / 100,
            provider: provider.key,
            date: bankTx.bookingDate,
          });
        }
      }
    }
  } catch (error: any) {
    // Log error but don't fail - detection is best-effort
    if (isDev) {
      console.error('[internalTransfer] ✗ Error in detectPaymentProviderFunding:', error?.message || error, error?.stack);
    }
  }
  
  if (isDev && detected.length > 0) {
    console.log(`[internalTransfer] Detected ${detected.length} payment provider funding transfer(s)`);
  }
  
  return detected;
}

