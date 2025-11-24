import type { NormalizedTransaction } from '../../hooks/useTransactionsData';

export interface RecurringCandidate {
  merchant: string;
  typicalAmount: number;
  lastDate: string;
  medianIntervalDays: number;
}

/**
 * Normalize merchant name for grouping
 */
function normalizeMerchant(merchant: string): string {
  return merchant.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Calculate standard deviation
 */
function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calculate median
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Detect recurring transaction candidates
 */
export function detectRecurringCandidates(
  txs: NormalizedTransaction[],
  options?: { minOccurrences?: number },
): RecurringCandidate[] {
  const minOccurrences = options?.minOccurrences ?? 3;

  // Only consider expenses
  const expenses = txs.filter(tx => tx.amount < 0);

  // Group by normalized merchant
  const groups = new Map<string, NormalizedTransaction[]>();
  for (const tx of expenses) {
    const normalized = normalizeMerchant(tx.merchant);
    const arr = groups.get(normalized) ?? [];
    arr.push(tx);
    groups.set(normalized, arr);
  }

  const candidates: RecurringCandidate[] = [];

  for (const [merchant, group] of groups.entries()) {
    if (group.length < minOccurrences) continue;

    // Sort by booking date
    const sorted = group
      .filter(tx => tx.bookingDate)
      .sort((a, b) => {
        const dateA = new Date(a.bookingDate!).getTime();
        const dateB = new Date(b.bookingDate!).getTime();
        return dateA - dateB;
      });

    if (sorted.length < minOccurrences) continue;

    // Calculate intervals between consecutive charges
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const dateA = new Date(sorted[i - 1].bookingDate!).getTime();
      const dateB = new Date(sorted[i].bookingDate!).getTime();
      const days = (dateB - dateA) / (1000 * 60 * 60 * 24);
      intervals.push(days);
    }

    if (intervals.length === 0) continue;

    const medianInterval = median(intervals);

    // Check if median interval is between 25 and 35 days (monthly-ish)
    if (medianInterval < 25 || medianInterval > 35) continue;

    // Check amount consistency
    const amounts = sorted.map(tx => Math.abs(tx.amount));
    const meanAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const stddev = standardDeviation(amounts);

    // Require stddev <= 0.15 * mean (amount doesn't vary too wildly)
    if (stddev > 0.15 * meanAmount) continue;

    // Find most recent date
    const lastDate = sorted[sorted.length - 1].bookingDate!;

    candidates.push({
      merchant: group[0].merchant, // Use original merchant name
      typicalAmount: meanAmount,
      lastDate,
      medianIntervalDays: Math.round(medianInterval),
    });
  }

  // Sort by typical amount descending
  candidates.sort((a, b) => b.typicalAmount - a.typicalAmount);

  return candidates.slice(0, 3); // Return top 3
}

