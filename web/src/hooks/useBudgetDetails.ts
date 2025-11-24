import { useEffect, useState } from 'react';
import { fetchBudgetById } from '../api/budgetsApi';
import type { BudgetSummary } from '../types/budgets';

export function useBudgetDetails(id: string | null) {
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setBudget(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchBudgetById(id);
        if (!cancelled) {
          setBudget(data);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Fehler beim Laden des Budgets');
          setBudget(null);
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
  }, [id]);

  return { budget, isLoading, error };
}

