import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchCategorySuggestion, sendCategoryFeedback, isAiCategorizationEnabled, type AiCategorySuggestion } from '../api/aiCategoryApi';

interface UseAiCategorySuggestionOptions {
  transactionId: string;
  category: string | null;
  categoryConfidence: number | null;
  enabled?: boolean; // Whether to fetch suggestion (e.g., when row is expanded/hovered)
}

import { getBatchCacheSuggestion } from './useBatchAiSuggestions';

/**
 * Hook to manage AI category suggestions for a transaction.
 * 
 * **Design:**
 * - Respects batch cache: if a suggestion exists in the global batch cache, uses it immediately
 * - Only fetches if enabled AND no batch suggestion available
 * - Prevents duplicate requests when batch mode is active
 * 
 * **Usage:**
 * ```tsx
 * const { suggestion, isLoading, hasFetched } = useAiCategorySuggestion({
 *   transactionId: 'tx-123',
 *   category: 'other',
 *   categoryConfidence: 0.5,
 *   enabled: true, // Only fetch when enabled
 * });
 * ```
 */
export function useAiCategorySuggestion({
  transactionId,
  category,
  categoryConfidence,
  enabled = false,
}: UseAiCategorySuggestionOptions) {
  const [suggestion, setSuggestion] = useState<AiCategorySuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const lastTransactionIdRef = useRef<string | null>(null);

  // Check if AI is enabled globally
  const aiEnabled = isAiCategorizationEnabled();

  // Only fetch if:
  // - AI is enabled globally
  // - enabled prop is true (e.g., row is expanded/hovered)
  // - transaction needs review (category is 'other', 'other_review', null, or low confidence < 0.7)
  // - we haven't fetched yet (and batch cache doesn't have it)
  // - suggestion hasn't been dismissed
  // Note: For "Sonstiges" transactions, we want to fetch suggestions even if confidence is null/undefined
  const needsReview = 
    category === 'other' || 
    category === 'other_review' || 
    category === null || 
    category === undefined ||
    (categoryConfidence !== null && categoryConfidence !== undefined && categoryConfidence < 0.7);
  
  // Check batch cache - if available, don't fetch
  const batchCacheEntry = getBatchCacheSuggestion(transactionId);
  
  const shouldFetch =
    aiEnabled &&
    enabled &&
    !batchCacheEntry && // Don't fetch if batch cache has it
    !hasFetched &&
    !isDismissed &&
    needsReview;

  useEffect(() => {
    if (!shouldFetch) {
      if (import.meta.env.DEV) {
        // Determine the specific reason for not fetching to help debug eligibility logic
        let reason: 'globally disabled' | 'enabled prop false' | 'already fetched' | 'dismissed' | 'batch cache available' | 'ineligible';
        if (!aiEnabled) {
          reason = 'globally disabled';
        } else if (!enabled) {
          reason = 'enabled prop false';
        } else if (batchCacheEntry) {
          reason = 'batch cache available';
        } else if (hasFetched) {
          reason = 'already fetched';
        } else if (isDismissed) {
          reason = 'dismissed';
        } else {
          reason = 'ineligible';
        }
        console.debug(`[useAiCategorySuggestion] Not fetching for tx ${transactionId}: ${reason}`);
      }
      return;
    }

    let cancelled = false;

    async function loadSuggestion() {
      setIsLoading(true);
      if (import.meta.env.DEV) {
        console.debug(`[useAiCategorySuggestion] Fetching suggestion for tx ${transactionId}`, {
          category,
          categoryConfidence,
          needsReview,
        });
      }
      try {
        const result = await fetchCategorySuggestion(transactionId);
        if (!cancelled) {
          if (result) {
            if (import.meta.env.DEV) {
              console.debug(`[useAiCategorySuggestion] Got suggestion for tx ${transactionId}:`, result);
            }
            setSuggestion(result);
          } else {
            // No suggestion returned (could be rate-limited, AI disabled, or transaction not eligible)
            if (import.meta.env.DEV) {
              console.debug(`[useAiCategorySuggestion] No suggestion returned for tx ${transactionId} (likely rate-limited, AI disabled, or transaction not eligible)`);
            }
          }
          setHasFetched(true); // Mark as fetched even if no suggestion (to avoid retrying)
        }
      } catch (error) {
        if (!cancelled) {
          // Always log errors (not just in dev) as they indicate real problems
          console.error('[useAiCategorySuggestion] Error fetching suggestion:', error);
          setHasFetched(true); // Mark as fetched on error to prevent infinite retries
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSuggestion();

    return () => {
      cancelled = true;
    };
  }, [shouldFetch, transactionId, aiEnabled, enabled, hasFetched, isDismissed, category, categoryConfidence]);

  const handleAccept = useCallback(
    async (newCategoryId: string) => {
      if (!suggestion) return;

      // Send feedback
      await sendCategoryFeedback({
        transactionId,
        suggestedCategoryId: suggestion.categoryId,
        accepted: true,
      });

      // Clear suggestion
      setSuggestion(null);
      setIsDismissed(true);
    },
    [suggestion, transactionId],
  );

  const handleDismiss = useCallback(() => {
    if (!suggestion) return;

    // Send feedback
    void sendCategoryFeedback({
      transactionId,
      suggestedCategoryId: suggestion.categoryId,
      accepted: false,
    });

    // Clear suggestion
    setSuggestion(null);
    setIsDismissed(true);
  }, [suggestion, transactionId]);

  // Reset when transaction changes
  useEffect(() => {
    // Only reset if transaction ID actually changed
    if (lastTransactionIdRef.current !== transactionId) {
      lastTransactionIdRef.current = transactionId;
      setSuggestion(null);
      setHasFetched(false);
      setIsDismissed(false);
      
      // Check batch cache for new transaction
      const batchEntry = getBatchCacheSuggestion(transactionId);
      if (batchEntry) {
        setSuggestion(batchEntry);
        setHasFetched(true);
      }
    }
  }, [transactionId]);

  return {
    suggestion,
    isLoading,
    hasFetched,
    handleAccept,
    handleDismiss,
  };
}

