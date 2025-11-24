/**
 * useBatchAiSuggestions Hook
 * 
 * Fetches AI category suggestions for multiple transactions in a single batch request.
 * This hook is designed to be safe, efficient, and non-blocking:
 * 
 * **Design Principles:**
 * - **Caching**: Each transaction ID is requested at most once per session (in-memory cache)
 * - **Batching**: Groups transaction IDs into chunks (default: 50 per batch)
 * - **Concurrency Control**: Limits concurrent requests (default: max 2 at a time)
 * - **Rate Limiting**: Client-side throttle to respect backend limits
 * - **Non-blocking**: Failures don't prevent UI from rendering
 * - **Deduplication**: Filters out IDs that already have suggestions or are in-flight
 * 
 * **Usage:**
 * ```tsx
 * const { getSuggestion, isLoading, rateLimited } = useBatchAiSuggestions(
 *   transactionIds,  // Array of transaction IDs to fetch suggestions for
 *   true             // enabled flag - only fetch when true
 * );
 * 
 * const suggestion = getSuggestion('tx-123');
 * ```
 * 
 * **Extending:**
 * - To change batch size: modify BATCH_SIZE constant
 * - To change concurrency: modify MAX_CONCURRENT_REQUESTS constant
 * - To change rate limit: modify REQUESTS_PER_MINUTE constant
 * - To persist cache: replace Map with localStorage-backed store
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { isAiCategorizationEnabled } from '../api/aiCategoryApi';
import type { AiCategorySuggestion } from '../api/aiCategoryApi';

export interface BatchAiSuggestion {
  transactionId: string;
  suggestedCategoryId: string | null;
  confidence: number | null;
  explanation?: string;
}

export interface BatchAiSuggestionsResponse {
  suggestions: BatchAiSuggestion[];
  skippedIds: string[];
  rateLimited?: boolean;
  disabled?: boolean;
  message?: string;
}

// Configuration constants
const BATCH_SIZE = 50; // Maximum transaction IDs per batch request
const MAX_CONCURRENT_REQUESTS = 2; // Maximum concurrent batch requests
const REQUESTS_PER_MINUTE = 10; // Client-side rate limit (requests per minute)

// Global session cache - persists across hook instances
// This ensures we don't re-request suggestions for the same transaction ID
const globalCache = new Map<string, BatchAiSuggestion | 'failed' | 'pending'>();

/**
 * Get a suggestion from the global batch cache (for use by per-row hooks)
 * This allows useAiCategorySuggestion to check if a suggestion is already available
 * without making duplicate requests.
 */
export function getBatchCacheSuggestion(transactionId: string): AiCategorySuggestion | null {
  const cached = globalCache.get(transactionId);
  if (cached && cached !== 'failed' && cached !== 'pending' && cached.suggestedCategoryId) {
    return {
      categoryId: cached.suggestedCategoryId,
      confidence: cached.confidence ?? 0,
      reasoning: cached.explanation,
    };
  }
  return null;
}

/**
 * Check if batch has attempted to fetch a suggestion for a transaction ID
 * Returns true if the ID is in cache (even if result was null/failed), false if never attempted
 */
export function hasBatchAttempted(transactionId: string): boolean {
  return globalCache.has(transactionId);
}

const requestQueue: Array<{ ids: string[]; resolve: (value: BatchAiSuggestion[]) => void; reject: (error: Error) => void }> = [];
let activeRequests = 0;
let lastRequestTime = 0;
const requestTimes: number[] = []; // Track request times for rate limiting

/**
 * Rate limiter: returns true if we can make a request, false if we should wait
 */
function canMakeRequest(): boolean {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  
  // Remove old request times
  while (requestTimes.length > 0 && requestTimes[0] < oneMinuteAgo) {
    requestTimes.shift();
  }
  
  // Check if we're under the limit
  return requestTimes.length < REQUESTS_PER_MINUTE;
}

/**
 * Record that a request was made
 */
function recordRequest(): void {
  requestTimes.push(Date.now());
}

/**
 * Process the next item in the queue
 */
async function processQueue(): Promise<void> {
  // Don't process if we're at max concurrency or queue is empty
  if (activeRequests >= MAX_CONCURRENT_REQUESTS || requestQueue.length === 0) {
    return;
  }

  // Check rate limit
  if (!canMakeRequest()) {
    if (import.meta.env.DEV) {
      console.debug('[useBatchAiSuggestions] Rate limit reached, waiting...');
    }
    // Retry after a short delay
    setTimeout(() => processQueue(), 2000);
    return;
  }

  const item = requestQueue.shift();
  if (!item) return;

  activeRequests++;
  recordRequest();

  try {
    if (import.meta.env.DEV) {
      console.debug('[useBatchAiSuggestions] Processing batch of', item.ids.length, 'transaction IDs');
    }

    const res = await fetch('/api/ai/category-suggestions/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transactionIds: item.ids }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      throw new Error(`Failed to fetch batch suggestions: ${res.status} ${errorText}`);
    }

    const data = (await res.json()) as BatchAiSuggestionsResponse;

    if (data.disabled) {
      if (import.meta.env.DEV) {
        console.debug('[useBatchAiSuggestions] AI categorization is disabled on backend');
      }
      // Mark all IDs as failed (but don't throw - graceful degradation)
      item.ids.forEach(id => {
        if (!globalCache.has(id)) {
          globalCache.set(id, 'failed');
        }
      });
      item.resolve([]);
      return;
    }

    if (data.rateLimited) {
      if (import.meta.env.DEV) {
        console.warn('[useBatchAiSuggestions] Rate limited - batch suggestions unavailable');
      }
      // Mark all IDs as failed for now (they can be retried later)
      item.ids.forEach(id => {
        if (!globalCache.has(id)) {
          globalCache.set(id, 'failed');
        }
      });
      item.resolve([]);
      return;
    }

    // Update cache with successful suggestions
    const suggestions: BatchAiSuggestion[] = [];
    for (const suggestion of data.suggestions) {
      globalCache.set(suggestion.transactionId, suggestion);
      suggestions.push(suggestion);
    }

    // Mark skipped IDs as failed (they were skipped for a reason)
    for (const skippedId of data.skippedIds) {
      if (!globalCache.has(skippedId)) {
        globalCache.set(skippedId, 'failed');
      }
    }

    if (import.meta.env.DEV) {
      console.debug('[useBatchAiSuggestions] Received', data.suggestions.length, 'suggestions,', data.skippedIds.length, 'skipped');
    }

    item.resolve(suggestions);
  } catch (err: any) {
    console.error('[useBatchAiSuggestions] Error fetching batch suggestions:', err);
    // Mark all IDs as failed
    item.ids.forEach(id => {
      if (!globalCache.has(id)) {
        globalCache.set(id, 'failed');
      }
    });
    item.reject(err);
  } finally {
    activeRequests--;
    // Process next item in queue
    processQueue();
  }
}

/**
 * Queue a batch request for the given transaction IDs
 */
function queueBatchRequest(ids: string[]): Promise<BatchAiSuggestion[]> {
  return new Promise((resolve, reject) => {
    requestQueue.push({ ids, resolve, reject });
    processQueue();
  });
}

/**
 * Hook to fetch batch AI suggestions for a list of transaction IDs.
 * 
 * @param transactionIds - Array of transaction IDs to get suggestions for
 * @param enabled - Whether to fetch suggestions (e.g., when component is mounted and transactions are loaded)
 * @returns { getSuggestion, isLoading, error, rateLimited, refetch }
 */
/**
 * Normalize transaction IDs array: sort and deduplicate
 * This ensures we can compare arrays by value, not reference
 */
function normalizeIds(ids: string[]): string[] {
  return Array.from(new Set(ids)).sort();
}

/**
 * Compare two arrays of IDs by value (not reference)
 */
function idsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((id, i) => id === b[i]);
}

/**
 * Hook to fetch batch AI suggestions for a list of transaction IDs.
 * 
 * **API Surface:**
 * - Never throws synchronously for normal inputs
 * - Treats missing or empty `transactionIds` as a no-op
 * - Returns stable references for callbacks and state
 * - Logs only in `import.meta.env.DEV` mode
 * 
 * **Return Type:**
 * ```ts
 * {
 *   suggestions: Map<string, BatchAiSuggestion>;  // All cached suggestions
 *   getSuggestion: (id: string) => AiCategorySuggestion | null;  // Get single suggestion
 *   isLoading: boolean;  // True while fetching
 *   error: string | null;  // Error message if fetch failed
 *   rateLimited: boolean;  // True if rate limited
 *   refetch: () => Promise<void>;  // Manually trigger refetch
 * }
 * ```
 * 
 * @param transactionIds - Array of transaction IDs to fetch suggestions for (can be empty)
 * @param enabled - Whether to fetch suggestions (default: true)
 * @returns Hook result with suggestions, loading state, and error handling
 */
export function useBatchAiSuggestions(
  transactionIds: string[],
  enabled: boolean = true,
) {
  // Handle edge cases: empty array or missing input
  const safeTransactionIds = Array.isArray(transactionIds) ? transactionIds : [];
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastProcessedIdsRef = useRef<string[]>([]); // Store normalized array for comparison
  const lastNormalizedIdsRef = useRef<string[]>([]); // Store last normalized input IDs
  const repeatedCallWarningRef = useRef<Map<string, number>>(new Map()); // Track repeated calls for safety logging

  // Normalize and memoize the input IDs array
  // Use join(",") as dependency to ensure stability even when array reference changes
  // This prevents treating a new array with the same values as a change
  const normalizedIds = useMemo(() => {
    if (safeTransactionIds.length === 0) {
      return [];
    }
    return normalizeIds(safeTransactionIds);
  }, [safeTransactionIds.join(',')]);

  // Memoize eligible IDs computation to avoid recomputing on every render
  // Eligible IDs are those that need fetching (not cached, not pending)
  const eligibleIds = useMemo(() => {
    if (!enabled || normalizedIds.length === 0) {
      return [];
    }

    // Check if AI is enabled
    if (!isAiCategorizationEnabled()) {
      return [];
    }

    const unique = Array.from(new Set(normalizedIds)); // Deduplicate
    const eligible: string[] = [];
    
    for (const id of unique) {
      const cached = globalCache.get(id);
      // Only request if:
      // - Not already cached (as suggestion or failed)
      // - Not currently pending
      if (cached === undefined || cached === 'pending') {
        eligible.push(id);
      }
    }
    
    return normalizeIds(eligible); // Normalize for stable comparison
  }, [normalizedIds, enabled]);

  // Stable reference to check if we should fetch
  // Only fetch if we have eligible IDs that haven't been processed yet
  const shouldFetch = useMemo(() => {
    if (eligibleIds.length === 0) {
      return false;
    }

    // Check if we've already processed these exact eligible IDs
    if (idsEqual(eligibleIds, lastProcessedIdsRef.current)) {
      return false;
    }

    // Check if the normalized input IDs have actually changed
    if (idsEqual(normalizedIds, lastNormalizedIdsRef.current)) {
      return false;
    }

    return true;
  }, [eligibleIds, normalizedIds]);

  const fetchBatchSuggestions = useCallback(async () => {
    // Early exits - these don't trigger state updates to avoid render loops
    if (!shouldFetch) {
      if (import.meta.env.DEV) {
        if (eligibleIds.length === 0) {
          console.debug('[useBatchAiSuggestions] All transaction IDs already cached or pending');
        } else if (idsEqual(eligibleIds, lastProcessedIdsRef.current)) {
          console.debug('[useBatchAiSuggestions] Same eligible IDs already processed, skipping');
        } else if (idsEqual(normalizedIds, lastNormalizedIdsRef.current)) {
          console.debug('[useBatchAiSuggestions] IDs unchanged (normalized), skipping fetch');
        }
      }
      // Update refs to prevent re-checking (no state update = no re-render)
      lastNormalizedIdsRef.current = normalizedIds;
      return;
    }

    // Safety logging: detect repeated calls with same IDs
    if (import.meta.env.DEV) {
      const idsKey = normalizedIds.join(',');
      const count = repeatedCallWarningRef.current.get(idsKey) || 0;
      repeatedCallWarningRef.current.set(idsKey, count + 1);
      
      if (count >= 3) {
        console.warn(
          '[useBatchAiSuggestions] Repeated calls detected with same IDs:',
          normalizedIds.slice(0, 5),
          '... (showing first 5)',
          '\nStack trace:',
          new Error().stack
        );
      }
    }

    try {
      setIsLoading(true);
      setError(null);
      setRateLimited(false);

      // Mark as pending
      eligibleIds.forEach(id => {
        if (!globalCache.has(id)) {
          globalCache.set(id, 'pending');
        }
      });

      // Split into batches
      const batches: string[][] = [];
      for (let i = 0; i < eligibleIds.length; i += BATCH_SIZE) {
        batches.push(eligibleIds.slice(i, i + BATCH_SIZE));
      }

      if (import.meta.env.DEV) {
        console.debug('[useBatchAiSuggestions] Fetching batch suggestions for', eligibleIds.length, 'transactions in', batches.length, 'batches');
      }

      // Process all batches (they'll be queued and rate-limited automatically)
      const promises = batches.map(batch => queueBatchRequest(batch));
      await Promise.allSettled(promises);

      // Update last processed set (store normalized array)
      lastProcessedIdsRef.current = eligibleIds;
      // Update last normalized input IDs
      lastNormalizedIdsRef.current = normalizedIds;

      // Check if we hit rate limits
      if (!canMakeRequest()) {
        setRateLimited(true);
      }
    } catch (err: any) {
      // Always log errors (not just in dev) as they indicate real problems
      console.error('[useBatchAiSuggestions] Error in fetchBatchSuggestions:', err);
      setError(err?.message || 'Failed to fetch batch suggestions');
      
      // Mark eligible IDs as failed
      eligibleIds.forEach(id => {
        if (globalCache.get(id) === 'pending') {
          globalCache.set(id, 'failed');
        }
      });
      
      // Still update last normalized IDs to prevent retrying immediately
      lastNormalizedIdsRef.current = normalizedIds;
    } finally {
      setIsLoading(false);
    }
  }, [shouldFetch, eligibleIds, normalizedIds]);

  // Fetch on mount or when shouldFetch changes
  // Note: shouldFetch is memoized and only changes when truly needed
  useEffect(() => {
    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Only fetch if we should
    if (shouldFetch) {
      void fetchBatchSuggestions();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [shouldFetch, fetchBatchSuggestions]);

  // Get suggestion for a specific transaction ID
  // Returns: AiCategorySuggestion if available, null otherwise (for backward compatibility)
  // Use hasAttempted() to distinguish between "not attempted" and "attempted but no suggestion"
  const getSuggestion = useCallback(
    (transactionId: string): AiCategorySuggestion | null => {
      const cached = globalCache.get(transactionId);
      
      // Return null if not cached, failed, or pending
      if (!cached || cached === 'failed' || cached === 'pending') {
        return null;
      }

      // Return suggestion if available
      if (cached.suggestedCategoryId) {
        return {
          categoryId: cached.suggestedCategoryId,
          confidence: cached.confidence ?? 0,
          reasoning: cached.explanation,
        };
      }

      return null;
    },
    [],
  );
  
  // Check if batch has attempted to fetch for a transaction ID
  const hasAttempted = useCallback(
    (transactionId: string): boolean => {
      return globalCache.has(transactionId);
    },
    [],
  );

  // Get all suggestions as a Map (for compatibility)
  const getSuggestionsMap = useCallback((): Map<string, BatchAiSuggestion> => {
    const map = new Map<string, BatchAiSuggestion>();
    for (const [id, value] of globalCache.entries()) {
      if (value !== 'failed' && value !== 'pending' && value.suggestedCategoryId) {
        map.set(id, value);
      }
    }
    return map;
  }, []);

  return {
    suggestions: getSuggestionsMap(),
    getSuggestion,
    hasAttempted,
    isLoading,
    error,
    rateLimited,
    refetch: fetchBatchSuggestions,
  };
}
