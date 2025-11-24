import { useState, useEffect, useCallback } from 'react';
import { fetchCoachStory, type CoachStoryResponse } from '../api/coachApi';
import { subscribeToDataMutations } from '../lib/dataEvents';

interface UseCoachStoryOptions {
  days?: number;
  autoFetch?: boolean;
}

/**
 * Hook to manage AI coach story fetching and state.
 * Automatically refetches when data mutations occur (e.g., after CSV import).
 */
export function useCoachStory({ days = 30, autoFetch = true }: UseCoachStoryOptions = {}) {
  const [story, setStory] = useState<CoachStoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchStory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchCoachStory(days);
      setStory(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch coach story');
      setError(error);
      setStory(null);
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  // Initial fetch
  useEffect(() => {
    if (autoFetch) {
      void fetchStory();
    }
  }, [autoFetch, fetchStory]);

  // Refetch when data mutations occur (e.g., CSV import)
  useEffect(() => {
    const unsubscribe = subscribeToDataMutations(() => {
      // Debounce: only refetch if not currently loading
      if (!isLoading) {
        void fetchStory();
      }
    });
    return unsubscribe;
  }, [fetchStory, isLoading]);

  return {
    story,
    isLoading,
    error,
    refetch: fetchStory,
  };
}

