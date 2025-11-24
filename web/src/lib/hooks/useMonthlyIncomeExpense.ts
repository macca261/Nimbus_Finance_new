import { useState, useEffect } from 'react';
import { apiSummary } from '../api';

export interface MonthlyIncomeExpensePoint {
  month: string; // ISO string or "YYYY-MM"
  totalIncomeCents: number;
  totalExpenseCents: number;
}

export function useMonthlyIncomeExpense() {
  const [data, setData] = useState<MonthlyIncomeExpensePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setIsLoading(true);
        setError(null);
        const result = await apiSummary.monthlyIncomeExpense();
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load monthly income/expense data');
          setData([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void fetchData();

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLoading, error };
}

