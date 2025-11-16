import type { NormalizedCanonicalRow } from '../db';

export type ReimbursementRole = 'payer' | 'receiver';

export interface ReimbursementMatchConfig {
  daysWindow?: number; // default 30
  minRatio?: number; // default 0.25 (e.g. 25% share)
  maxRatio?: number; // default 1.00 (full reimbursement)
}

export interface ReimbursementMatch {
  expense: NormalizedCanonicalRow; // original negative transaction
  income: NormalizedCanonicalRow; // incoming reimbursement
  shareRatio: number; // income / expenseAbs, between 0 and 1
  groupId: string;
}

/**
 * Check if a ratio is close to a "nice" fraction (0.5, 0.33, 1.0, etc.)
 * Used for preference ordering when multiple matches exist.
 */
function isNiceFraction(ratio: number): boolean {
  const niceFractions = [0.25, 0.33, 0.5, 0.67, 0.75, 1.0];
  return niceFractions.some(nice => Math.abs(ratio - nice) < 0.01);
}

/**
 * Score a potential match for preference ordering.
 * Higher score = better match.
 */
function scoreMatch(
  expense: NormalizedCanonicalRow,
  income: NormalizedCanonicalRow,
  ratio: number,
): number {
  let score = 0;

  // Prefer same category (if both have categories)
  if (expense.category && income.category && expense.category === income.category) {
    score += 100;
  }

  // Prefer nice fractions (0.5, 1.0, etc.)
  if (isNiceFraction(ratio)) {
    score += 50;
  }

  // Prefer closer dates (smaller date difference = higher score)
  const expenseDate = new Date(expense.bookingDate);
  const incomeDate = new Date(income.bookingDate);
  const daysDiff = Math.abs((expenseDate.getTime() - incomeDate.getTime()) / (1000 * 60 * 60 * 24));
  score += Math.max(0, 30 - daysDiff); // Max 30 points for same day, decreases by 1 per day

  // Prefer closer ratio to 1.0 (full reimbursement)
  score += (1.0 - Math.abs(1.0 - ratio)) * 20;

  return score;
}

/**
 * Find a reimbursement match for an income transaction.
 * 
 * Requirements:
 * - Income: amountCents > 0, not a refund, not an internal transfer
 * - Expense: amountCents < 0, not a refund, not an internal transfer, not already a reimbursement
 * - Same accountId (or related payment source)
 * - Time window: |expenseDate - incomeDate| <= daysWindow (default 30)
 * - Amount ratio: income / expenseAbs between minRatio (0.25) and maxRatio (1.0)
 * 
 * Preference ordering:
 * - Same category family
 * - Nearest in date
 * - Nearest in ratio to a "nice" fraction (0.5, 0.33, 1.0)
 * 
 * @param income - The income transaction to find a match for
 * @param expenses - Array of expense transactions to search
 * @param config - Configuration options
 * @returns The best matching expense if found, null otherwise
 */
export function findReimbursementMatchForIncome(
  income: NormalizedCanonicalRow,
  expenses: NormalizedCanonicalRow[],
  config: ReimbursementMatchConfig = {},
): ReimbursementMatch | null {
  const daysWindow = config.daysWindow ?? 30;
  const minRatio = config.minRatio ?? 0.25;
  const maxRatio = config.maxRatio ?? 1.0;

  // Only consider income-like candidates
  if (income.amountCents <= 0) {
    return null;
  }

  // Skip if already part of a refund or internal transfer
  if (income.isRefund || income.isRefunded || income.refundGroupId) {
    return null;
  }
  if (income.isInternalTransfer || income.internalTransferGroupId) {
    return null;
  }

  // Skip if already part of a reimbursement
  if (income.isReimbursement || income.reimbursementGroupId) {
    return null;
  }

  const incomeDate = new Date(income.bookingDate);
  const incomeAmount = income.amountCents;

  // Find all valid matches
  const candidates: Array<{ expense: NormalizedCanonicalRow; ratio: number; score: number }> = [];

  for (const expense of expenses) {
    // Skip if expense is already part of a refund or internal transfer
    if (expense.isRefund || expense.isRefunded || expense.refundGroupId) {
      continue;
    }
    if (expense.isInternalTransfer || expense.internalTransferGroupId) {
      continue;
    }

    // Skip if already part of a reimbursement
    if (expense.isReimbursement || expense.reimbursementGroupId) {
      continue;
    }

    // Must be an expense (negative amount)
    if (expense.amountCents >= 0) {
      continue;
    }

    // Must be same accountId (for now, conservative)
    if (income.accountId && expense.accountId && income.accountId !== expense.accountId) {
      continue;
    }

    // Check time window
    const expenseDate = new Date(expense.bookingDate);
    const daysDiff = Math.abs((incomeDate.getTime() - expenseDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > daysWindow) {
      continue;
    }

    // Check amount ratio
    const expenseAbs = Math.abs(expense.amountCents);
    const ratio = incomeAmount / expenseAbs;

    if (ratio < minRatio || ratio > maxRatio) {
      continue;
    }

    // All conditions met - add to candidates
    const score = scoreMatch(expense, income, ratio);
    candidates.push({ expense, ratio, score });
  }

  // If no candidates, return null
  if (candidates.length === 0) {
    return null;
  }

  // Sort by score (highest first) and pick the best match
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  // Generate deterministic groupId
  const ids = [best.expense.publicId, income.publicId].sort();
  const groupId = `rb_${ids[0]}_${ids[1]}`;

  return {
    expense: best.expense,
    income,
    shareRatio: best.ratio,
    groupId,
  };
}

/**
 * Apply reimbursement flags to both rows in a match.
 * 
 * @param match - The reimbursement match
 * @returns Updated copies of both rows with flags set
 */
export function applyReimbursementFlags(
  match: ReimbursementMatch,
): { expense: NormalizedCanonicalRow; income: NormalizedCanonicalRow } {
  const expenseWithFlags: NormalizedCanonicalRow = {
    ...match.expense,
    isReimbursement: true,
    reimbursementRole: 'payer',
    reimbursementGroupId: match.groupId,
    reimbursementShareRatio: match.shareRatio,
  };

  const incomeWithFlags: NormalizedCanonicalRow = {
    ...match.income,
    isReimbursement: true,
    reimbursementRole: 'receiver',
    reimbursementGroupId: match.groupId,
    reimbursementShareRatio: match.shareRatio,
  };

  return { expense: expenseWithFlags, income: incomeWithFlags };
}

