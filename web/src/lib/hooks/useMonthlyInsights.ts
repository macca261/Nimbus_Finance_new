import { useState, useEffect } from 'react';
import { getCategoryLabel } from '../categories';

export type MonthlyInsights = {
  topCategory?: {
    legacyCategoryId: string;
    labelDe: string;
    amountCents: number;
  };
  biggestExpense?: {
    amountCents: number;
    label: string; // merchant or shortened purpose
  };
  transactionCount: number;
  isLoading: boolean;
  error?: string;
};

type Transaction = {
  id: number;
  bookingDate: string | null;
  amountCents?: number;
  amount?: number;
  payee?: string | null;
  counterpart?: string | null;
  purpose?: string | null;
  memo?: string | null;
  category?: string | null;
  isInternalTransfer?: boolean;
  isPassThrough?: boolean;
  isReimbursement?: boolean;
  isCashWithdrawal?: boolean;
};

/**
 * Hook to fetch monthly insights for the last 30 days:
 * - Top spending category
 * - Largest single expense
 * - Transaction count
 */
export function useMonthlyInsights(): MonthlyInsights {
  const [insights, setInsights] = useState<MonthlyInsights>({
    transactionCount: 0,
    isLoading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchInsights() {
      try {
        setInsights(prev => ({ ...prev, isLoading: true, error: undefined }));

        // Calculate date 30 days ago (YYYY-MM-DD format)
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        const startDate = thirtyDaysAgo.toISOString().split('T')[0];

        // Fetch transactions from the last 30 days
        // Using a higher limit to ensure we get most transactions in the period
        // Note: If there are more than 500 transactions, the count will be approximate
        const res = await fetch(`/api/transactions?startDate=${startDate}&limit=500`);
        if (!res.ok) {
          throw new Error('Failed to fetch transactions');
        }

        const data = (await res.json()) as { ok: boolean; transactions: Transaction[] };
        if (cancelled) return;

        const transactions = data.transactions ?? [];

        // Filter to only expenses and exclude internal transfers, pass-through, reimbursements, cash withdrawals
        const expenses = transactions.filter(tx => {
          const amountCents = tx.amountCents ?? (tx.amount ? Math.round(tx.amount * 100) : 0);
          if (amountCents >= 0) return false; // Only expenses
          if (tx.isInternalTransfer) return false;
          if (tx.isPassThrough) return false;
          if (tx.isReimbursement) return false;
          if (tx.isCashWithdrawal) return false;
          return true;
        });

        // Calculate top category
        const categoryTotals = new Map<string, number>();
        for (const tx of expenses) {
          const category = tx.category || 'other';
          const amountCents = tx.amountCents ?? (tx.amount ? Math.round(tx.amount * 100) : 0);
          const currentTotal = categoryTotals.get(category) ?? 0;
          categoryTotals.set(category, currentTotal + Math.abs(amountCents));
        }

        let topCategory: MonthlyInsights['topCategory'] | undefined;
        if (categoryTotals.size > 0) {
          const sorted = Array.from(categoryTotals.entries())
            .sort((a, b) => b[1] - a[1]);
          const [categoryId, amountCents] = sorted[0];
          topCategory = {
            legacyCategoryId: categoryId,
            labelDe: getCategoryLabel(categoryId),
            amountCents,
          };
        }

        // Find largest single expense
        let biggestExpense: MonthlyInsights['biggestExpense'] | undefined;
        if (expenses.length > 0) {
          const largest = expenses.reduce((max, tx) => {
            const txAmount = tx.amountCents ?? (tx.amount ? Math.round(tx.amount * 100) : 0);
            const maxAmount = max.amountCents ?? (max.amount ? Math.round(max.amount * 100) : 0);
            return txAmount < maxAmount ? tx : max;
          });
          
          const amountCents = largest.amountCents ?? (largest.amount ? Math.round(largest.amount * 100) : 0);
          // Create label from payee, counterpart, or purpose/memo
          const label = 
            largest.payee?.trim() ||
            largest.counterpart?.trim() ||
            largest.purpose?.trim() ||
            largest.memo?.trim() ||
            'Unbekannt';
          
          // Truncate to ~40 characters
          const shortLabel = label.length > 40 ? label.slice(0, 37) + '...' : label;
          
          biggestExpense = {
            amountCents: Math.abs(amountCents),
            label: shortLabel,
          };
        }

        // Count all transactions (not filtered)
        const transactionCount = transactions.length;

        if (!cancelled) {
          setInsights({
            topCategory,
            biggestExpense,
            transactionCount,
            isLoading: false,
          });
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[useMonthlyInsights] Failed to fetch insights:', err);
        setInsights(prev => ({
          ...prev,
          isLoading: false,
          error: 'Konnte Monatsüberblick nicht laden',
        }));
      }
    }

    fetchInsights();
    return () => {
      cancelled = true;
    };
  }, []);

  return insights;
}

