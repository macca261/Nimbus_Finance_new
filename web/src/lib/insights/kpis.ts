import type { NormalizedTransaction } from '../../hooks/useTransactionsData';

export interface KpiMetrics {
  totalExpenses: number;
  totalIncome: number;
  netto: number;
  transactionCount: number;
}

/**
 * Calculate KPI metrics from normalized transactions
 */
export function calculateKpis(transactions: NormalizedTransaction[]): KpiMetrics {
  const expenses = transactions.filter(tx => tx.amount < 0);
  const income = transactions.filter(tx => tx.amount > 0);

  const totalExpenses = expenses.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const totalIncome = income.reduce((sum, tx) => sum + tx.amount, 0);
  const netto = totalIncome - totalExpenses;
  const transactionCount = transactions.length;

  return {
    totalExpenses,
    totalIncome,
    netto,
    transactionCount,
  };
}

