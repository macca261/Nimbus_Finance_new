/**
 * Split Service
 * 
 * Handles transaction splitting logic for the "Transaction Inbox" workflow.
 * Enables the "PayPal Reimbursement" use case (+€20 Inflow -> Split into multiple contra-expenses).
 * 
 * Architecture: "Splits-Only" reporting - all analytics SUM(transaction_splits.amount_cents)
 */

import { z } from 'zod';
import type { Database } from '../db';
import crypto from 'node:crypto';

/**
 * Zod schema for split validation
 * 
 * Ensures:
 * - All splits sum to exactly parentAmountCents (zero-sum constraint)
 * - Works for both positive inflows and negative outflows
 * - No sign inversion (preserves original transaction sign)
 */
export const SplitValidator = z.object({
  parentId: z.string().or(z.number()),
  parentAmountCents: z.number().int(),
  splits: z.array(
    z.object({
      categoryId: z.string().nullable(),
      amountCents: z.number().int(),
      memo: z.string().nullable().optional(),
    })
  ).min(1, 'At least one split is required'),
}).refine(
  (data) => {
    const sum = data.splits.reduce((acc, split) => acc + split.amountCents, 0);
    return sum === data.parentAmountCents;
  },
  {
    message: 'Sum of splits must equal parent transaction amount',
    path: ['splits'],
  }
);

export type SplitInput = z.infer<typeof SplitValidator>;

export interface TransactionSplit {
  id: string;
  transactionId: number;
  amountCents: number;
  categoryId: string | null;
  memo: string | null;
  createdAt: string;
}

/**
 * Execute a transaction split
 * 
 * Steps:
 * 1. Validate input (Zod schema + zero-sum constraint)
 * 2. Delete all existing splits for the parent transaction
 * 3. Batch insert new splits
 * 4. Update transactions.review_status to 'reviewed'
 * 
 * Uses better-sqlite3 transactions for atomicity.
 */
export function executeSplit(
  db: Database,
  input: SplitInput
): { success: true; splits: TransactionSplit[] } | { success: false; error: string } {
  try {
    // Step 1: Validate input
    const validated = SplitValidator.parse(input);
    
    // Convert parentId to number if it's a string
    const transactionId = typeof validated.parentId === 'string' 
      ? parseInt(validated.parentId, 10) 
      : validated.parentId;

    if (isNaN(transactionId)) {
      return { success: false, error: 'Invalid transaction ID' };
    }

    // Verify transaction exists
    const transaction = db.prepare('SELECT id, amountCents FROM transactions WHERE id = ?').get(transactionId) as 
      { id: number; amountCents: number } | undefined;

    if (!transaction) {
      return { success: false, error: 'Transaction not found' };
    }

    // Verify parent amount matches
    if (transaction.amountCents !== validated.parentAmountCents) {
      return { 
        success: false, 
        error: `Parent amount mismatch: expected ${validated.parentAmountCents}, found ${transaction.amountCents}` 
      };
    }

    // Step 2-4: Execute in a transaction
    const result = db.transaction(() => {
      // Step 2: Delete all existing splits for this transaction
      db.prepare('DELETE FROM transaction_splits WHERE transaction_id = ?').run(transactionId);

      // Step 3: Batch insert new splits
      const insertStmt = db.prepare(`
        INSERT INTO transaction_splits (id, transaction_id, amount_cents, category_id, memo, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      const splits: TransactionSplit[] = [];
      for (const split of validated.splits) {
        const id = crypto.randomUUID();
        insertStmt.run(
          id,
          transactionId,
          split.amountCents,
          split.categoryId || null,
          split.memo || null
        );

        splits.push({
          id,
          transactionId,
          amountCents: split.amountCents,
          categoryId: split.categoryId || null,
          memo: split.memo || null,
          createdAt: new Date().toISOString(),
        });
      }

      // Step 4: Update review_status to 'reviewed'
      db.prepare('UPDATE transactions SET review_status = ? WHERE id = ?').run('reviewed', transactionId);

      return splits;
    })();

    return { success: true, splits: result };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { 
        success: false, 
        error: `Validation error: ${err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}` 
      };
    }
    
    console.error('[splitService] executeSplit error:', err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    };
  }
}

/**
 * Get all splits for a transaction
 */
export function getSplitsForTransaction(
  db: Database,
  transactionId: number
): TransactionSplit[] {
  const rows = db.prepare(`
    SELECT 
      id,
      transaction_id as transactionId,
      amount_cents as amountCents,
      category_id as categoryId,
      memo,
      created_at as createdAt
    FROM transaction_splits
    WHERE transaction_id = ?
    ORDER BY created_at ASC
  `).all(transactionId) as TransactionSplit[];

  return rows;
}

/**
 * Get transaction with its splits
 */
export function getTransactionWithSplits(
  db: Database,
  transactionId: number
): {
  transaction: { id: number; amountCents: number; reviewStatus: string | null } | null;
  splits: TransactionSplit[];
} {
  const transaction = db.prepare(`
    SELECT id, amountCents, review_status as reviewStatus
    FROM transactions
    WHERE id = ?
  `).get(transactionId) as { id: number; amountCents: number; reviewStatus: string | null } | undefined;

  const splits = transaction ? getSplitsForTransaction(db, transactionId) : [];

  return {
    transaction: transaction || null,
    splits,
  };
}

