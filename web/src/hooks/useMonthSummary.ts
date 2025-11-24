import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { subscribeToDataMutations } from '../lib/dataEvents';

export interface MonthSummary {
  period: { start: string; end: string };
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  changeVsPrevMonthPct: number | null;
  topCategories: Array<{
    categoryId: string;
    name: string;
    amountCents: number;
    sharePct: number;
  }>;
  biggestExpense: {
    transactionId: string;
    displayName: string;
    amountCents: number;
    date: string;
    categoryId: string | null;
    categoryName: string | null;
  } | null;
  highlights: Array<{
    type: string;
    data: Record<string, unknown>;
  }>;
}

export interface MonthNarrative {
  bullets: string[];
}

export interface MonthSummaryResponse {
  summary: MonthSummary;
  narrative: MonthNarrative;
}

interface UseMonthSummaryOptions {
  month?: string; // YYYY-MM format
  autoFetch?: boolean;
}

/**
 * Hook to manage month summary fetching and state.
 * Automatically refetches when data mutations occur (e.g., after CSV import).
 */
export function useMonthSummary({ month, autoFetch = true }: UseMonthSummaryOptions = {}) {
  const [data, setData] = useState<MonthSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSummary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (month) {
        params.set('month', month);
      }
      const response = await api.get<MonthSummaryResponse>(`/summary/month-narrative?${params.toString()}`);
      setData(response.data);
    } catch (err: any) {
      // Handle 404/503 as "feature disabled" gracefully
      if (err?.response?.status === 404 || err?.response?.status === 503) {
        // Try to get numeric summary only
        try {
          const params = new URLSearchParams();
          if (month) {
            params.set('month', month);
          }
          const numericResponse = await api.get<{ summary: MonthSummary }>(`/summary/month?${params.toString()}`);
          setData({
            summary: numericResponse.data.summary,
            narrative: { bullets: [] }, // Empty narrative when feature is disabled
          });
        } catch (numericErr) {
          const error = numericErr instanceof Error ? numericErr : new Error('Failed to fetch month summary');
          setError(error);
          setData(null);
        }
      } else {
        const error = err instanceof Error ? err : new Error('Failed to fetch month summary');
        setError(error);
        setData(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [month]);

  // Initial fetch
  useEffect(() => {
    if (autoFetch) {
      void fetchSummary();
    }
  }, [autoFetch, fetchSummary]);

  // Refetch when data mutations occur (e.g., CSV import)
  useEffect(() => {
    const unsubscribe = subscribeToDataMutations(() => {
      // Debounce: only refetch if not currently loading
      if (!isLoading) {
        void fetchSummary();
      }
    });
    return unsubscribe;
  }, [fetchSummary, isLoading]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchSummary,
  };
}

