/**
 * useGamificationData Hook
 * 
 * Fetches gamification snapshot (XP, level, rank, streak, quests) from the backend.
 * This prepares Nimbus for future Pro tier features and enhanced user engagement.
 */

import { useState, useEffect } from 'react';

export interface GamificationSnapshot {
  xp: number;
  level: number;
  rankLabel: string;
  streakDays: number;
  activeQuests: Array<{
    id: string;
    title: string;
    progressPercent: number;
  }>;
  recentlyCompletedQuests: Array<{
    id: string;
    title: string;
    completedAt: string;
  }>;
}

export function useGamificationData() {
  // Default safe snapshot
  const defaultSnapshot: GamificationSnapshot = {
    xp: 0,
    level: 1,
    rankLabel: 'Bronze Budgeter',
    streakDays: 0,
    activeQuests: [],
    recentlyCompletedQuests: [],
  };

  const [data, setData] = useState<GamificationSnapshot>(defaultSnapshot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        
        const res = await fetch('/api/gamification');
        
        if (!res.ok) {
          // Even on error, use default snapshot instead of null
          throw new Error(`Failed to load gamification data: ${res.status}`);
        }
        
        const json = await res.json();
        
        if (!cancelled) {
          // Validate response has required fields, fallback to default if not
          if (json && typeof json.xp === 'number' && typeof json.level === 'number') {
            setData(json);
          } else {
            console.warn('[useGamificationData] Invalid response format, using default');
            setData(defaultSnapshot);
          }
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          // Log error but don't crash - use default snapshot
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[useGamificationData] Error loading gamification:', err);
          }
          setError(err);
          // Always provide a valid snapshot, even on error
          setData(defaultSnapshot);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}

