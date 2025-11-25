/**
 * Transaction Service
 * 
 * Handles transaction distribution and inbox workflow operations.
 * Provides the "distributeTransaction" function for splitting transactions.
 */

import { z } from 'zod';
import type { Database } from '../db';
import crypto from 'node:crypto';

/**
 * Zod schema for transaction distribution
 */
export const DistributeTransactionValidator = z.object({
  transactionId: z.string().or(z.number()),
  allocations: z.array(
    z.object({
      categoryId: z.string(),
      amount: z.number(), // In EUR, will be converted to cents
    })
  ).min(1, 'At least one allocation is required'),
}).refine(
  (data) => {
    const sumCents = data.allocations.reduce((acc, alloc) => acc + Math.round(alloc.amount * 100), 0);
    // We'll validate against the actual transaction amount in the function
    return sumCents !== 0; // At least some amount must be allocated
  },
  {
    message: 'Total allocations must not be zero',
    path: ['allocations'],
  }
);

export type DistributeTransactionInput = z.infer<typeof DistributeTransactionValidator>;

export interface TransactionAllocation {
  id: string;
  transactionId: string;
  categoryId: string;
  amountCents: number;
  memo: string | null;
}

/**
 * Distribute a transaction into multiple category allocations
 * 
 * - Validates that sum of allocations equals transaction amount
 * - For positive transactions (Income/Reimbursement), allows assigning to Expense Categories (Refund/Contra-Expense)
 * - Inserts rows into transaction_splits
 * - Marks parent transaction status as 'reviewed'
 * 
 * @param db Database instance
 * @param input Distribution input with transactionId and allocations
 * @returns Success result with allocations or error
 */
export function distributeTransaction(
  db: Database,
  input: DistributeTransactionInput
): { success: true; allocations: TransactionAllocation[] } | { success: false; error: string } {
  try {
    // Validate input
    const validated = DistributeTransactionValidator.parse(input);
    
    // Convert transactionId to string if it's a number
    const transactionId = typeof validated.transactionId === 'string' 
      ? validated.transactionId 
      : validated.transactionId.toString();

    // Get transaction
    const transaction = db.prepare(`
      SELECT id, amountCents, payee, status
      FROM transactions
      WHERE id = ? OR publicId = ?
    `).get(transactionId, transactionId) as 
      { id: number; amountCents: number; payee: string | null; status: string | null } | undefined;

    if (!transaction) {
      return { success: false, error: 'Transaction not found' };
    }

    // Convert allocations to cents and validate sum
    const allocationsInCents = validated.allocations.map(alloc => ({
      categoryId: alloc.categoryId,
      amountCents: Math.round(alloc.amount * 100),
    }));

    const totalAllocated = allocationsInCents.reduce((sum, alloc) => sum + alloc.amountCents, 0);

    if (totalAllocated !== transaction.amountCents) {
      return {
        success: false,
        error: `Sum of allocations (${totalAllocated / 100} EUR) must equal transaction amount (${transaction.amountCents / 100} EUR)`,
      };
    }

    // Execute in a transaction
    const result = db.transaction(() => {
      // Delete existing splits
      db.prepare('DELETE FROM transaction_splits WHERE transaction_id = ?').run(transaction.id.toString());

      // Insert new allocations
      const insertStmt = db.prepare(`
        INSERT INTO transaction_splits (id, transaction_id, category_id, amount_cents, memo)
        VALUES (?, ?, ?, ?, NULL)
      `);

      const allocations: TransactionAllocation[] = [];
      for (const alloc of allocationsInCents) {
        const id = crypto.randomUUID();
        insertStmt.run(
          id,
          transaction.id, // Use integer ID directly
          alloc.categoryId,
          alloc.amountCents
        );

        allocations.push({
          id,
          transactionId: transaction.id.toString(), // Keep as string for API consistency
          categoryId: alloc.categoryId,
          amountCents: alloc.amountCents,
          memo: null,
        });
      }

      // Update transaction status to 'reviewed'
      db.prepare('UPDATE transactions SET status = ? WHERE id = ?').run('reviewed', transaction.id);

      return allocations;
    })();

    return { success: true, allocations: result };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return {
        success: false,
        error: `Validation error: ${err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
      };
    }

    console.error('[transactionService] distributeTransaction error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Get inbox transactions (status === 'inbox')
 */
export function getInboxTransactions(
  db: Database,
  limit: number = 100
): Array<{
  id: number;
  publicId: string | null;
  bookingDate: string;
  amountCents: number;
  payee: string | null;
  memo: string | null;
  category: string | null;
  status: string | null;
}> {
  const rows = db.prepare(`
    SELECT 
      id,
      publicId,
      bookingDate,
      amountCents,
      payee,
      memo,
      category,
      status
    FROM transactions
    WHERE status = 'inbox' OR status IS NULL
    ORDER BY bookingDate DESC
    LIMIT ?
  `).all(limit) as Array<{
    id: number;
    publicId: string | null;
    bookingDate: string;
    amountCents: number;
    payee: string | null;
    memo: string | null;
    category: string | null;
    status: string | null;
  }>;

  return rows;
}

/**
 * Approve transaction (keep auto-category, mark as reviewed)
 */
export function approveTransaction(
  db: Database,
  transactionId: string | number
): { success: boolean; error?: string } {
  try {
    const id = typeof transactionId === 'string' ? parseInt(transactionId, 10) : transactionId;
    
    if (isNaN(id)) {
      return { success: false, error: 'Invalid transaction ID' };
    }

    db.prepare('UPDATE transactions SET status = ? WHERE id = ?').run('reviewed', id);
    return { success: true };
  } catch (err) {
    console.error('[transactionService] approveTransaction error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Skip transaction (mark as skipped)
 */
export function skipTransaction(
  db: Database,
  transactionId: string | number
): { success: boolean; error?: string } {
  try {
    const id = typeof transactionId === 'string' ? parseInt(transactionId, 10) : transactionId;
    
    if (isNaN(id)) {
      return { success: false, error: 'Invalid transaction ID' };
    }

    db.prepare('UPDATE transactions SET status = ? WHERE id = ?').run('skipped', id);
    return { success: true };
  } catch (err) {
    console.error('[transactionService] skipTransaction error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Suggest categories for a PayPal reimbursement transaction
 * Looks at recent expenses matching the amount
 */
export function suggestCategoriesForReimbursement(
  db: Database,
  amountCents: number,
  limit: number = 5
): Array<{ categoryId: string; category: string; count: number; totalAmount: number }> {
  // Find recent expenses with similar amounts (within 10% tolerance)
  const tolerance = Math.abs(amountCents) * 0.1;
  const minAmount = Math.abs(amountCents) - tolerance;
  const maxAmount = Math.abs(amountCents) + tolerance;

  const rows = db.prepare(`
    SELECT 
      category as categoryId,
      category,
      COUNT(*) as count,
      SUM(ABS(amountCents)) as totalAmount
    FROM transactions
    WHERE amountCents < 0
      AND ABS(amountCents) BETWEEN ? AND ?
      AND category IS NOT NULL
      AND category != ''
      AND bookingDate >= date('now', '-30 days')
    GROUP BY category
    ORDER BY count DESC, totalAmount DESC
    LIMIT ?
  `).all(minAmount, maxAmount, limit) as Array<{
    categoryId: string;
    category: string;
    count: number;
    totalAmount: number;
  }>;

  return rows;
}

