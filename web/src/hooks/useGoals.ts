import { useEffect, useState } from 'react';
import { fetchGoals } from '../api/goalsApi';
import type { GoalProgress } from '../types/goals';

export function useGoals(params?: { isActive?: boolean }) {
  const [goals, setGoals] = useState<GoalProgress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchGoals(params);
        if (!cancelled) {
          setGoals(data);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Fehler beim Laden der Ziele');
          setGoals([]);
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
  }, [params?.isActive]);

  return { goals, isLoading, error, refetch: () => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchGoals(params);
        setGoals(data);
      } catch (err: any) {
        setError(err?.message || 'Fehler beim Laden der Ziele');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  } };
}

