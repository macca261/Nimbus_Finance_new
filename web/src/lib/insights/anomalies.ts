import type { NormalizedTransaction } from '../../hooks/useTransactionsData';
import { getCategoryLabel } from '../categories';

export interface AnomalousTransaction {
  tx: NormalizedTransaction;
  zScore: number;
  categoryLabel: string;
}

/**
 * Calculate mean
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Find unusual expenses (outliers)
 */
export function findUnusualExpenses(txs: NormalizedTransaction[]): AnomalousTransaction[] {
  // Only consider expenses
  const expenses = txs.filter(tx => tx.amount < 0 && Math.abs(tx.amount) >= 50);

  // Group by category
  const byCategory = new Map<string, NormalizedTransaction[]>();
  for (const tx of expenses) {
    const category = tx.categoryId ?? 'other';
    const arr = byCategory.get(category) ?? [];
    arr.push(tx);
    byCategory.set(category, arr);
  }

  const anomalies: AnomalousTransaction[] = [];

  for (const [categoryId, categoryTxs] of byCategory.entries()) {
    // Need at least 5 transactions in category
    if (categoryTxs.length < 5) continue;

    const amounts = categoryTxs.map(tx => Math.abs(tx.amount));
    const meanAmount = mean(amounts);
    const stddev = standardDeviation(amounts);

    if (stddev === 0) continue; // All amounts are the same

    // Flag transactions where abs(amount) > mean + 2.5 * stddev
    for (const tx of categoryTxs) {
      const absAmount = Math.abs(tx.amount);
      if (absAmount > meanAmount + 2.5 * stddev) {
        const zScore = (absAmount - meanAmount) / stddev;
        anomalies.push({
          tx,
          zScore,
          categoryLabel: getCategoryLabel(categoryId),
        });
      }
    }
  }

  // Sort by z-score descending (most unusual first)
  anomalies.sort((a, b) => b.zScore - a.zScore);

  return anomalies.slice(0, 5); // Return top 5
}

