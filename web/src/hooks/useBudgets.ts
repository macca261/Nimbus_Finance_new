import { useEffect, useState } from 'react';
import { fetchBudgets } from '../api/budgetsApi';
import type { BudgetSummary } from '../types/budgets';

export function useBudgets(params?: { month?: string; period?: string }) {
  const [budgets, setBudgets] = useState<BudgetSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchBudgets(params);
        if (!cancelled) {
          setBudgets(data);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Fehler beim Laden der Budgets');
          setBudgets([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [params?.month, params?.period]);

  return { budgets, isLoading, error, refetch: () => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchBudgets(params);
        setBudgets(data);
      } catch (err: any) {
        setError(err?.message || 'Fehler beim Laden der Budgets');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  } };
}

