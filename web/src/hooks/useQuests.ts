/**
 * useQuests Hook
 * 
 * Fetches active quests from the backend and provides refetch functionality.
 * Quests are gamification tasks that guide users toward better financial organization.
 */

import { useState, useEffect, useCallback } from 'react';

export type QuestKind =
  | 'CLEANUP'
  | 'IMPORT'
  | 'SPENDING'
  | 'OTHER';

export type QuestStatus = 'LOCKED' | 'ACTIVE' | 'COMPLETED';

export interface Quest {
  id: string;
  kind: QuestKind;
  title: string;
  description: string; // Max 120 chars
  status: QuestStatus;
  currentValue: number;
  targetValue: number;
  progressPercent: number; // 0–100
  progressCurrent?: number; // Alias for currentValue (for backward compatibility)
  progressTarget?: number; // Alias for targetValue (for backward compatibility)
  cta: {
    label: string;
    href: string;
  };
  ctaPath?: string; // Alias for cta.href (for backward compatibility)
}

interface QuestsResponse {
  quests: Quest[];
}

/**
 * Hook to fetch and manage active quests.
 * 
 * Automatically refetches when data events occur (e.g., after CSV import, category changes).
 * 
 * @returns { quests, isLoading, error, refetch }
 */
export function useQuests() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuests = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Try new endpoint first, fallback to /active for backward compatibility
      const res = await fetch('/api/quests');
      if (!res.ok) {
        throw new Error('Quests konnten nicht geladen werden.');
      }
      
      const data = (await res.json()) as QuestsResponse;
      // Map backend DTO to frontend Quest format (add backward-compat aliases)
      const mappedQuests: Quest[] = (data.quests ?? []).map(q => ({
        ...q,
        progressCurrent: q.currentValue,
        progressTarget: q.targetValue,
        ctaPath: q.cta.href,
      }));
      setQuests(mappedQuests);
    } catch (err: any) {
      console.error('[useQuests] Error fetching quests:', err);
      setError(err?.message || 'Fehler beim Laden der Quests');
      setQuests([]); // Clear quests on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    void fetchQuests();
  }, [fetchQuests]);

  // Listen for data events to refetch quests
  useEffect(() => {
    const handleDataEvent = () => {
      // Refetch quests when data changes (e.g., after import, category change)
      void fetchQuests();
    };

    // Listen for custom events (e.g., from CSV import, category updates)
    window.addEventListener('nimbus:data-changed', handleDataEvent);
    
    return () => {
      window.removeEventListener('nimbus:data-changed', handleDataEvent);
    };
  }, [fetchQuests]);

  return {
    quests,
    isLoading,
    error,
    refetch: fetchQuests,
  };
}

