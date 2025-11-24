import { useEffect, useMemo, useState, useCallback } from 'react';
import type { ApiTransaction } from '../pages/Transactions';
import { getCategoryLabel } from '../lib/categories';
import { getTransactionDisplayName } from '../lib/transactions/displayName';

type PeriodFilter = '30d' | '90d' | 'year';

export type NormalizedTransaction = {
  id: number;
  bookingDate: string | null;
  amount: number;
  categoryId: string | null;
  categoryLabel: string;
  merchant: string;
  counterparty: string;
};

type TransactionResponse = {
  ok: boolean;
  total: number;
  transactions: ApiTransaction[];
};

export function useTransactionsData(period: PeriodFilter = '90d') {
  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPeriod, setCurrentPeriod] = useState<PeriodFilter>(period);

  // Calculate date range based on period
  const dateRange = useMemo(() => {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date();

    if (currentPeriod === '30d') {
      startDate.setDate(startDate.getDate() - 30);
    } else if (currentPeriod === '90d') {
      startDate.setDate(startDate.getDate() - 90);
    } else if (currentPeriod === 'year') {
      startDate.setFullYear(startDate.getFullYear() - 1);
    }

    startDate.setHours(0, 0, 0, 0);
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  }, [currentPeriod]);

  // Fetch transactions
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const params = new URLSearchParams();
        params.set('startDate', dateRange.startDate);
        params.set('endDate', dateRange.endDate);
        params.set('limit', '10000'); // Get all transactions for insights

        const res = await fetch(`/api/transactions?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) {
          throw new Error('Transaktionen konnten nicht geladen werden.');
        }
        const json = (await res.json()) as TransactionResponse;
        setTransactions(
          (json.transactions ?? []).map(tx => ({
            ...tx,
            bookingDate: tx.bookingDate ?? tx.bookedAt ?? null,
          })),
        );
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        setError(err?.message || 'Transaktionen konnten nicht geladen werden.');
        setTransactions([]);
      } finally {
        setIsLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [dateRange]);

  // Normalize transactions for insights
  const normalizedTransactions = useMemo<NormalizedTransaction[]>(() => {
    return transactions
      .filter(tx => {
        // Exclude internal transfers, pass-through, and cash withdrawals from insights
        if (tx.isInternalTransfer) return false;
        if (tx.isPassThrough) return false;
        if (tx.isCashWithdrawal) return false;
        return true;
      })
      .map(tx => {
        // Use centralized display name helper for consistent user-friendly labels
        const merchant = getTransactionDisplayName(tx);
        const counterparty = tx.counterpart || tx.payee || '—';
        const categoryId = tx.category ?? null;
        const categoryLabel = categoryId ? getCategoryLabel(categoryId) : 'Sonstiges';

        return {
          id: tx.id,
          bookingDate: tx.bookingDate,
          amount: tx.amount,
          categoryId,
          categoryLabel,
          merchant,
          counterparty,
        };
      });
  }, [transactions]);

  return {
    transactions: normalizedTransactions,
    isLoading,
    error,
    currentPeriod,
    setCurrentPeriod,
  };
}

