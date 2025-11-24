/**
 * Subscription detection helper.
 * 
 * Detects likely recurring payments (subscriptions) from transaction data.
 * This is a pure function - no database writes, just analysis.
 * 
 * Heuristics:
 * - Group by normalized merchant name
 * - Require at least 3 transactions
 * - Check for consistent amount (within ~10-15% variance)
 * - Detect monthly or yearly frequency patterns
 */

import { normalizeMerchantNameForFuzzy } from '../categorizers/fuzzyMatcher';

export type SubscriptionCandidate = {
  merchantKey: string;        // normalized merchant id (reuse fuzzy merchant normalization)
  displayName: string;
  avgAmountCents: number;
  stddevAmountCents: number;
  txCount: number;
  firstDate: string;         // yyyy-mm-dd
  lastDate: string;
  frequency: 'monthly' | 'yearly' | 'unknown';
};

type TransactionInput = {
  id: number;
  bookingDate: string;       // yyyy-mm-dd
  amountCents: number;
  payee?: string | null;
  counterpartName?: string | null;
  purpose?: string | null;
  memo?: string | null;
};

type MerchantGroup = {
  merchantKey: string;
  displayName: string;
  transactions: TransactionInput[];
};

/**
 * Calculate standard deviation of transaction amounts.
 */
function calculateStddev(amounts: number[]): number {
  if (amounts.length === 0) return 0;
  const mean = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
  const variance = amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length;
  return Math.sqrt(variance);
}

/**
 * Calculate days between two dates (yyyy-mm-dd format).
 */
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Detect frequency pattern from sorted transaction dates.
 * 
 * Returns 'monthly' if gaps are mostly 25-35 days,
 * 'yearly' if gaps are mostly 11-13 months (330-400 days),
 * 'unknown' otherwise.
 */
function detectFrequency(dates: string[]): 'monthly' | 'yearly' | 'unknown' {
  if (dates.length < 3) return 'unknown';
  
  // Sort dates
  const sorted = [...dates].sort();
  
  // Calculate gaps between consecutive dates
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = daysBetween(sorted[i - 1], sorted[i]);
    gaps.push(gap);
  }
  
  // Count how many gaps fall into monthly range (25-35 days)
  const monthlyGaps = gaps.filter(g => g >= 25 && g <= 35).length;
  // Count how many gaps fall into yearly range (330-400 days, roughly 11-13 months)
  const yearlyGaps = gaps.filter(g => g >= 330 && g <= 400).length;
  
  // Require at least 2 gaps to match the pattern
  // For monthly: at least 2/3 of gaps should be monthly
  if (gaps.length >= 2 && monthlyGaps >= Math.ceil(gaps.length * 0.6)) {
    return 'monthly';
  }
  
  // For yearly: at least 2/3 of gaps should be yearly
  if (gaps.length >= 2 && yearlyGaps >= Math.ceil(gaps.length * 0.6)) {
    return 'yearly';
  }
  
  return 'unknown';
}

/**
 * Detect subscription candidates from a list of transactions.
 * 
 * Groups transactions by normalized merchant, filters for likely subscriptions,
 * and returns candidates with frequency detection.
 */
export function detectSubscriptionCandidates(transactions: TransactionInput[]): SubscriptionCandidate[] {
  // Group by normalized merchant name
  const groupsMap = new Map<string, MerchantGroup>();
  
  for (const tx of transactions) {
    // Extract merchant display name (same logic as review.ts)
    const displayRaw = (tx.payee ?? tx.counterpartName ?? tx.purpose ?? tx.memo ?? '').trim();
    if (!displayRaw) continue;
    
    const normalized = normalizeMerchantNameForFuzzy(displayRaw);
    if (!normalized) continue;
    
    const group = groupsMap.get(normalized) ?? {
      merchantKey: normalized,
      displayName: displayRaw,
      transactions: [],
    };
    
    group.transactions.push(tx);
    groupsMap.set(normalized, group);
  }
  
  const candidates: SubscriptionCandidate[] = [];
  
  for (const group of groupsMap.values()) {
    // Only consider merchants with at least 3 transactions
    if (group.transactions.length < 3) continue;
    
    // Only consider expenses (negative amounts)
    const expenseTxs = group.transactions.filter(tx => tx.amountCents < 0);
    if (expenseTxs.length < 3) continue;
    
    // Extract amounts (as positive values for analysis)
    const amounts = expenseTxs.map(tx => Math.abs(tx.amountCents));
    const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const stddev = calculateStddev(amounts);
    
    // Check amount variance: stddev should be within ~10-15% of mean
    const varianceThreshold = avgAmount * 0.15;
    if (stddev > varianceThreshold) continue;
    
    // Extract dates and detect frequency
    const dates = expenseTxs.map(tx => tx.bookingDate).sort();
    const frequency = detectFrequency(dates);
    
    // Filter out 'unknown' frequency for now (per requirements)
    if (frequency === 'unknown') continue;
    
    candidates.push({
      merchantKey: group.merchantKey,
      displayName: group.displayName,
      avgAmountCents: Math.round(avgAmount),
      stddevAmountCents: Math.round(stddev),
      txCount: expenseTxs.length,
      firstDate: dates[0],
      lastDate: dates[dates.length - 1],
      frequency,
    });
  }
  
  // Sort by transaction count (descending), then by average amount (descending)
  return candidates.sort((a, b) => {
    if (b.txCount !== a.txCount) return b.txCount - a.txCount;
    return b.avgAmountCents - a.avgAmountCents;
  });
}

