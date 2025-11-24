/**
 * AI Category Eligibility Helper
 * 
 * Centralized logic to determine if a transaction is eligible for AI categorization.
 * This ensures consistent eligibility checks across single and batch suggestion flows.
 */

import type { Transaction } from '../types/core';

export type EligibilityReason =
  | 'eligible'
  | 'ai_disabled'
  | 'transaction_not_found'
  | 'already_categorised'
  | 'internal_transfer'
  | 'pass_through'
  | 'cash_withdrawal'
  | 'reimbursement'
  | 'low_amount'
  | 'missing_fields'
  | 'zero_amount';

export interface EligibilityResult {
  eligible: boolean;
  reason: EligibilityReason;
  details?: Record<string, unknown>;
}

/**
 * Check if a transaction is eligible for AI category suggestion.
 * 
 * A transaction is eligible if:
 * - It's not an internal transfer, pass-through, cash withdrawal, or reimbursement
 * - It has a non-null amount and booking date
 * - Its category is 'other', 'other_review', null, or has low confidence (< 0.8)
 * - The amount is >= 0.50 EUR (to filter out noise)
 */
export function isEligibleForAiSuggestion(
  transaction: Transaction | null,
  options?: {
    minAmountEur?: number; // Default: 0.50
    minConfidenceThreshold?: number; // Default: 0.8
  },
): EligibilityResult {
  const minAmountEur = options?.minAmountEur ?? 0.5;
  const minConfidenceThreshold = options?.minConfidenceThreshold ?? 0.8;

  // Transaction not found
  if (!transaction) {
    return {
      eligible: false,
      reason: 'transaction_not_found',
    };
  }

  // Missing required fields
  if (!transaction.bookingDate || transaction.amountCents === null || transaction.amountCents === undefined) {
    return {
      eligible: false,
      reason: 'missing_fields',
      details: {
        hasBookingDate: !!transaction.bookingDate,
        hasAmount: transaction.amountCents !== null && transaction.amountCents !== undefined,
      },
    };
  }

  // Zero amount
  if (transaction.amountCents === 0) {
    return {
      eligible: false,
      reason: 'zero_amount',
    };
  }

  // Internal transfers
  if (transaction.isTransfer || transaction.isInternalTransfer) {
    return {
      eligible: false,
      reason: 'internal_transfer',
      details: {
        isTransfer: transaction.isTransfer,
        isInternalTransfer: transaction.isInternalTransfer,
      },
    };
  }

  // Pass-through transactions
  // Note: We check for passThrough flag if it exists in the Transaction type
  if ((transaction as any).isPassThrough) {
    return {
      eligible: false,
      reason: 'pass_through',
    };
  }

  // Cash withdrawals
  if ((transaction as any).isCashWithdrawal) {
    return {
      eligible: false,
      reason: 'cash_withdrawal',
    };
  }

  // Reimbursements
  if (transaction.isReimbursement) {
    return {
      eligible: false,
      reason: 'reimbursement',
    };
  }

  // Low amount (filter out noise)
  const amountEur = Math.abs(transaction.amountCents) / 100;
  if (amountEur < minAmountEur) {
    return {
      eligible: false,
      reason: 'low_amount',
      details: {
        amountCents: transaction.amountCents,
        amountEur,
        threshold: minAmountEur,
      },
    };
  }

  // Already well-categorised
  const currentCategory = transaction.categoryId;
  const currentConfidence = transaction.confidence || 0;
  const isWellCategorised =
    currentCategory &&
    currentCategory !== 'other' &&
    currentCategory !== 'other_review' &&
    currentConfidence >= minConfidenceThreshold;

  if (isWellCategorised) {
    return {
      eligible: false,
      reason: 'already_categorised',
      details: {
        category: currentCategory,
        confidence: currentConfidence,
        threshold: minConfidenceThreshold,
      },
    };
  }

  // Eligible!
  return {
    eligible: true,
    reason: 'eligible',
  };
}

