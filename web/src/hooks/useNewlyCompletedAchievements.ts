import { useEffect, useRef } from 'react';
import type { Achievement } from '../types/achievements';
import { toast } from '../lib/toast';

type AchievementStatus = 'locked' | 'in_progress' | 'completed';

/**
 * Hook that detects newly completed achievements and shows toast notifications.
 * Compares previous achievements state with current state to find transitions from locked/in_progress to completed.
 */
export function useNewlyCompletedAchievements(achievements: Achievement[]) {
  const previousAchievementsRef = useRef<Map<string, AchievementStatus>>(new Map());

  useEffect(() => {
    // Build map of current achievements by key
    const currentMap = new Map<string, AchievementStatus>();
    for (const achievement of achievements) {
      currentMap.set(achievement.key, achievement.status);
    }

    // Compare with previous state
    const previousMap = previousAchievementsRef.current;
    
    // Find achievements that transitioned to completed
    for (const achievement of achievements) {
      const previousStatus = previousMap.get(achievement.key);
      const currentStatus = achievement.status;

      // If it's now completed and wasn't before, show toast
      if (currentStatus === 'completed' && previousStatus !== 'completed' && previousStatus !== undefined) {
        toast(`Neuer Erfolg: "${achievement.title}" 🎉`, 'success', 5000);
      }
    }

    // Update ref for next comparison
    previousAchievementsRef.current = currentMap;
  }, [achievements]);
}

