import type { NormalizedCanonicalRow } from '../db';
import crypto from 'node:crypto';

export type ReimbursementRole = 'payer' | 'receiver';

export interface ReimbursementResult {
  isReimbursement: true;
  reimbursementRole: ReimbursementRole;
  reimbursementGroupId: string;
  reimbursementShareRatio?: number | null;
}

export interface MatcherContext {
  recentTransactions?: NormalizedCanonicalRow[];
  daysWindow?: number;
}

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

/**
 * Normalize text for keyword matching.
 */
function normalizeTextForKeywords(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if text contains reimbursement keywords for incoming reimbursements.
 */
function hasReimbursementKeywords(text: string): boolean {
  const normalized = normalizeTextForKeywords(text);
  const keywords = [
    'RUCKBUCHUNG',
    'RUCKZAHLUNG',
    'RUECKZAHLUNG',
    'ERSTATTUNG',
    'GUTSCHRIFT',
    'ERSTATTUNG PAYPAL',
    'RUCKBUCHUNG PAYPAL',
    'P2P_AUTO_CANCEL',
    'REFUND',
    'RUCKERSTATTUNG',
  ];
  return keywords.some(keyword => normalized.includes(keyword));
}

/**
 * Check if text suggests a PayPal refund pattern.
 */
function isPayPalRefundPattern(text: string): boolean {
  const normalized = normalizeTextForKeywords(text);
  // PayPal refund patterns
  const patterns = [
    /RUCKBUCHUNG\s+PAYPAL/i,
    /PAYPAL.*RUCKBUCHUNG/i,
    /PAYPAL.*P2P_AUTO_CANCEL/i,
    /PAYPAL.*REFUND/i,
  ];
  return patterns.some(pattern => pattern.test(normalized));
}

/**
 * Generate a stable group ID for a reimbursement based on counterparty and month.
 */
function generateReimbursementGroupId(
  row: NormalizedCanonicalRow,
  role: ReimbursementRole,
): string {
  const counterpart = normalizeTextForKeywords(row.counterpartName ?? row.payee ?? '');
  const month = row.bookingDate.slice(0, 7); // YYYY-MM
  const hashInput = `${counterpart}_${month}_${role}`;
  const hash = crypto.createHash('sha256').update(hashInput).digest('hex').slice(0, 8);
  return `rb_keyword_${hash}`;
}

/**
 * Classify a single transaction as a reimbursement based on keywords and patterns.
 * This handles obvious reimbursements that don't require pairing with another transaction.
 * 
 * Priority:
 * 1. Incoming reimbursements (positive amounts) with refund keywords
 * 2. PayPal refund patterns
 * 3. P2P names that appear as both payee and payer (requires context)
 * 
 * @param row - The transaction to classify
 * @param ctx - Context with recent transactions for P2P matching
 * @returns ReimbursementResult if classified, null otherwise
 */
export function classifyReimbursementLike(
  row: NormalizedCanonicalRow,
  ctx: MatcherContext = {},
): ReimbursementResult | null {
  // Skip if already classified
  if (row.isReimbursement || row.reimbursementGroupId) {
    return null;
  }
  
  // Skip if already a refund or internal transfer
  if (row.isRefund || row.isRefunded || row.refundGroupId) {
    return null;
  }
  if (row.isInternalTransfer || row.internalTransferGroupId) {
    return null;
  }
  
  // Combine all text fields
  const purposeText = row.purpose ?? '';
  const memoText = row.memo ?? '';
  const counterpartText = row.counterpartName ?? '';
  const payeeText = row.payee ?? '';
  const combinedText = [purposeText, memoText, counterpartText, payeeText].join(' ');
  
  // Check for incoming reimbursements (positive amounts)
  if (row.amountCents > 0) {
    // Check for explicit reimbursement keywords
    if (hasReimbursementKeywords(combinedText)) {
      const groupId = generateReimbursementGroupId(row, 'receiver');
      return {
        isReimbursement: true,
        reimbursementRole: 'receiver',
        reimbursementGroupId: groupId,
        reimbursementShareRatio: null,
      };
    }
    
    // Check for PayPal refund patterns
    if (isPayPalRefundPattern(combinedText)) {
      const groupId = generateReimbursementGroupId(row, 'receiver');
      return {
        isReimbursement: true,
        reimbursementRole: 'receiver',
        reimbursementGroupId: groupId,
        reimbursementShareRatio: null,
      };
    }
    
    // Check for P2P reimbursement pattern: same name as recent expense
    const daysWindow = ctx.daysWindow ?? 30;
    const recentTransactions = ctx.recentTransactions ?? [];
    const rowDate = new Date(row.bookingDate);
    
    // Normalize counterparty name for matching
    const normalizedCounterpart = normalizeTextForKeywords(counterpartText || payeeText);
    if (normalizedCounterpart.length > 3) { // Only if we have a meaningful name
      // Look for recent negative transactions from the same counterparty
      const matchingExpense = recentTransactions.find(tx => {
        if (tx.publicId === row.publicId) return false;
        if (tx.amountCents >= 0) return false;
        if (tx.isReimbursement || tx.reimbursementGroupId) return false;
        if (tx.isRefund || tx.isRefunded || tx.refundGroupId) return false;
        if (tx.isInternalTransfer || tx.internalTransferGroupId) return false;
        
        const txCounterpart = normalizeTextForKeywords(tx.counterpartName ?? tx.payee ?? '');
        if (txCounterpart !== normalizedCounterpart) return false;
        
        const txDate = new Date(tx.bookingDate);
        const daysDiff = Math.abs((rowDate.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff <= daysWindow;
      });
      
      if (matchingExpense) {
        // Found a matching expense - this is likely a reimbursement
        const ids = [matchingExpense.publicId, row.publicId].sort();
        const groupId = `rb_${ids[0]}_${ids[1]}`;
        return {
          isReimbursement: true,
          reimbursementRole: 'receiver',
          reimbursementGroupId: groupId,
          reimbursementShareRatio: null,
        };
      }
    }
  }
  
  // Check for outgoing reimbursements (negative amounts) - more conservative
  if (row.amountCents < 0) {
    const recentTransactions = ctx.recentTransactions ?? [];
    const daysWindow = ctx.daysWindow ?? 30;
    const rowDate = new Date(row.bookingDate);
    
    // Normalize counterparty name
    const normalizedCounterpart = normalizeTextForKeywords(counterpartText || payeeText);
    if (normalizedCounterpart.length > 3) {
      // Look for recent positive transactions to the same counterparty
      const matchingIncome = recentTransactions.find(tx => {
        if (tx.publicId === row.publicId) return false;
        if (tx.amountCents <= 0) return false;
        if (tx.isReimbursement || tx.reimbursementGroupId) return false;
        if (tx.isRefund || tx.isRefunded || tx.refundGroupId) return false;
        if (tx.isInternalTransfer || tx.internalTransferGroupId) return false;
        
        const txCounterpart = normalizeTextForKeywords(tx.counterpartName ?? tx.payee ?? '');
        if (txCounterpart !== normalizedCounterpart) return false;
        
        const txDate = new Date(tx.bookingDate);
        const daysDiff = Math.abs((rowDate.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff <= daysWindow;
      });
      
      if (matchingIncome) {
        // Found a matching income - this negative might be paying back
        // Only mark if the income was already marked as a reimbursement
        if (matchingIncome.isReimbursement && matchingIncome.reimbursementGroupId) {
          return {
            isReimbursement: true,
            reimbursementRole: 'payer',
            reimbursementGroupId: matchingIncome.reimbursementGroupId,
            reimbursementShareRatio: matchingIncome.reimbursementShareRatio ?? null,
          };
        }
      }
    }
  }
  
  return null;
}

export interface ReimbursementMatchSignals {
  counterpartyScore: number;
  timeScore: number;
  amountScore: number;
  contextScore: number;
  noteScore: number;
  total: number;
}

interface ConfidenceContext {
  expenseRow: {
    amountCents: number;
    bookingDate: string;
    counterpartName: string | null;
    payee: string | null;
    purpose: string | null;
    memo: string | null;
    category: string | null;
  };
  reimbursementRow: {
    amountCents: number;
    bookingDate: string;
    counterpartName: string | null;
    payee: string | null;
    purpose: string | null;
    memo: string | null;
    category: string | null;
  };
}

/**
 * Compute confidence score for a reimbursement match.
 * Returns a score from 0-100 based on various signals.
 */
export function computeReimbursementConfidence(ctx: ConfidenceContext): ReimbursementMatchSignals {
  const { expenseRow, reimbursementRow } = ctx;

  // 1. Counterparty score (max 30)
  let counterpartyScore = 0;
  const expenseCounterpart = normalizeTextForKeywords(expenseRow.counterpartName ?? expenseRow.payee ?? '');
  const reimbursementCounterpart = normalizeTextForKeywords(reimbursementRow.counterpartName ?? reimbursementRow.payee ?? '');
  
  if (expenseCounterpart && reimbursementCounterpart) {
    if (expenseCounterpart === reimbursementCounterpart) {
      counterpartyScore = 30; // Exact match
    } else if (
      expenseCounterpart.includes(reimbursementCounterpart) ||
      reimbursementCounterpart.includes(expenseCounterpart)
    ) {
      counterpartyScore = 20; // Fuzzy match (contains)
    }
  }

  // 2. Time difference score (max 20)
  let timeScore = 0;
  const expenseDate = new Date(expenseRow.bookingDate);
  const reimbursementDate = new Date(reimbursementRow.bookingDate);
  const daysDiff = Math.abs((expenseDate.getTime() - reimbursementDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff === 0) {
    timeScore = 20;
  } else if (daysDiff <= 3) {
    timeScore = 17;
  } else if (daysDiff <= 7) {
    timeScore = 12;
  } else if (daysDiff <= 14) {
    timeScore = 8;
  } else if (daysDiff <= 30) {
    timeScore = 5;
  } else {
    timeScore = 0;
  }

  // 3. Amount correlation score (max 25)
  let amountScore = 0;
  const expenseAbs = Math.abs(expenseRow.amountCents);
  const reimbursementAbs = Math.abs(reimbursementRow.amountCents);
  
  if (expenseAbs > 0) {
    const ratio = reimbursementAbs / expenseAbs;
    if (ratio >= 0.95 && ratio <= 1.05) {
      amountScore = 25; // 95-105%
    } else if (ratio >= 0.80 && ratio <= 1.20) {
      amountScore = 18; // 80-120%
    } else if (ratio >= 0.50 && ratio <= 1.50) {
      amountScore = 10; // 50-150%
    }
  }

  // 4. Context / merchant score (max 15)
  let contextScore = 0;
  const expenseCategory = expenseRow.category;
  const reimbursementCategory = reimbursementRow.category;
  
  // Combine all text fields for merchant matching
  const expenseText = normalizeTextForKeywords(
    [expenseRow.purpose, expenseRow.memo, expenseRow.counterpartName, expenseRow.payee].filter(Boolean).join(' ')
  );
  const reimbursementText = normalizeTextForKeywords(
    [reimbursementRow.purpose, reimbursementRow.memo, reimbursementRow.counterpartName, reimbursementRow.payee].filter(Boolean).join(' ')
  );
  
  // Check for merchant name overlap (simple word-based)
  const expenseWords = expenseText.split(/\s+/).filter(w => w.length > 2);
  const reimbursementWords = reimbursementText.split(/\s+/).filter(w => w.length > 2);
  const commonWords = expenseWords.filter(w => reimbursementWords.includes(w));
  
  if (expenseCategory && reimbursementCategory && expenseCategory === reimbursementCategory) {
    if (commonWords.length >= 2) {
      contextScore = 15; // Same category + merchant keywords overlap
    } else {
      contextScore = 8; // Same category only
    }
  } else if (commonWords.length >= 2) {
    contextScore = 10; // Merchant keywords overlap but different category
  }

  // 5. Note / description keywords score (max 10)
  let noteScore = 0;
  const combinedText = normalizeTextForKeywords(
    [reimbursementRow.purpose, reimbursementRow.memo].filter(Boolean).join(' ')
  );
  
  const reimbursementKeywords = [
    'RUCKBUCHUNG',
    'RUCKZAHLUNG',
    'RUECKZAHLUNG',
    'ERSTATTUNG',
    'GUTSCHRIFT',
    'REFUND',
    'RUCKERSTATTUNG',
  ];
  
  const matchingKeywords = reimbursementKeywords.filter(keyword => combinedText.includes(keyword)).length;
  
  if (matchingKeywords >= 3) {
    noteScore = 10;
  } else if (matchingKeywords === 2) {
    noteScore = 7;
  } else if (matchingKeywords === 1) {
    noteScore = 4;
  }

  const total = Math.round(counterpartyScore + timeScore + amountScore + contextScore + noteScore);

  return {
    counterpartyScore,
    timeScore,
    amountScore,
    contextScore,
    noteScore,
    total: Math.min(100, Math.max(0, total)), // Clamp to 0-100
  };
}

