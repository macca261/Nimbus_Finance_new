/**
 * useGamificationData Hook
 * 
 * Fetches gamification summary (XP, rank, streak, quests) from the backend.
 * This prepares Nimbus for future Pro tier features and enhanced user engagement.
 */

import { useEffect, useState } from 'react';
import axios from 'axios';

export interface GamificationSummary {
  rank: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  xp: number;
  xpToNext: number;
  level: number;
  currentStreakDays: number;
  longestStreakDays: number;
  completedQuestsThisWeek: number;
  achievementsCompleted: number;
  nextSuggestedQuest?: {
    id: string;
    title: string;
    ctaLabel: string;
    ctaPath: string;
  } | null;
}

interface UseGamificationData {
  data: GamificationSummary | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useGamificationData(): UseGamificationData {
  const [data, setData] = useState<GamificationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await axios.get<GamificationSummary>('/api/gamification');
      setData(res.data);
    } catch (err: any) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[useGamificationData] Failed to fetch', err);
      }
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, isLoading, error, refetch: fetchData };
}
