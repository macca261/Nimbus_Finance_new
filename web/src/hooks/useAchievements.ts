import { useEffect, useState } from 'react';
import { fetchAchievements, evaluateAchievements as evaluateAchievementsApi } from '../api/achievementsApi';
import type { Achievement } from '../types/achievements';
import { useNewlyCompletedAchievements } from './useNewlyCompletedAchievements';

export function useAchievements() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchAchievements();
        if (!cancelled) {
          setAchievements(data);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Fehler beim Laden der Erfolge');
          setAchievements([]);
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
  }, []);

  const evaluate = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await evaluateAchievementsApi();
      setAchievements(data);
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Auswerten der Erfolge');
    } finally {
      setIsLoading(false);
    }
  };

  // Track newly completed achievements for toast notifications
  useNewlyCompletedAchievements(achievements);

  return { achievements, isLoading, error, evaluate, refetch: evaluate };
}

