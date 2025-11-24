import React from 'react';
import { Sparkles, Check } from 'lucide-react';
import type { AiSuggestionData } from './SonstigesTransactionRow';
import type { BatchAiSuggestion } from '../../hooks/useBatchAiSuggestions';

interface AiCleanupSummaryBarProps {
  suggestionData: Map<string, AiSuggestionData>;
  totalTransactions: number;
  onBatchAccept: () => void;
  isProcessing: boolean;
  // Optional: batch suggestions for transactions that haven't reported yet
  // This ensures we count all transactions, not just rendered ones
  batchSuggestions?: Map<string, BatchAiSuggestion>;
  batchHasAttempted?: (transactionId: string) => boolean;
}

export const AiCleanupSummaryBar: React.FC<AiCleanupSummaryBarProps> = ({
  suggestionData,
  totalTransactions,
  onBatchAccept,
  isProcessing,
  batchSuggestions,
  batchHasAttempted,
}) => {
  // Merge batch suggestions with row-reported suggestions
  // This ensures we count all transactions, not just rendered ones
  const allSuggestions = React.useMemo(() => {
    const merged = new Map<string, { suggestion: { categoryId: string; confidence: number; reasoning?: string } | null; hasFetched: boolean }>();
    
    // Add batch suggestions (convert BatchAiSuggestion format to AiCategorySuggestion format)
    if (batchSuggestions) {
      for (const [txId, batchSuggestion] of batchSuggestions.entries()) {
        // Only include if batch suggestion has a category ID (null means no suggestion)
        if (batchSuggestion.suggestedCategoryId) {
          merged.set(txId, {
            suggestion: {
              categoryId: batchSuggestion.suggestedCategoryId,
              confidence: batchSuggestion.confidence ?? 0,
              reasoning: batchSuggestion.explanation,
            },
            hasFetched: true,
          });
        } else if (batchHasAttempted && batchHasAttempted(txId)) {
          // Batch attempted but returned no suggestion - mark as fetched with null suggestion
          merged.set(txId, { suggestion: null, hasFetched: true });
        }
      }
    }
    
    // Add row-reported suggestions (override batch if present, as row data is more up-to-date)
    for (const [txId, data] of suggestionData.entries()) {
      if (data.hasFetched) {
        merged.set(txId, { suggestion: data.suggestion, hasFetched: true });
      }
    }
    
    return Array.from(merged.values());
  }, [suggestionData, batchSuggestions, batchHasAttempted]);
  
  // Count suggestions by confidence bucket
  const suggestions = allSuggestions.filter(
    (item) => item.suggestion !== null && item.hasFetched
  );
  const highConfidence = suggestions.filter(
    (data) => data.suggestion && data.suggestion.confidence >= 0.9
  );
  const mediumConfidence = suggestions.filter(
    (data) =>
      data.suggestion &&
      data.suggestion.confidence >= 0.75 &&
      data.suggestion.confidence < 0.9
  );
  const lowConfidence = suggestions.filter(
    (data) => data.suggestion && data.suggestion.confidence < 0.75
  );

  // Check if any rows are still loading
  const isLoading = Array.from(suggestionData.values()).some(
    (data) => data.isLoading
  );
  
  // Check if all transactions have been fetched but no suggestions available
  // This includes both row-reported data and batch attempts
  const allFetched = allSuggestions.length >= totalTransactions && 
    allSuggestions.every((item) => item.hasFetched) &&
    !isLoading;
  const hasSuggestions = suggestions.length > 0;
  const hasHighConfidence = highConfidence.length > 0;

  // Show graceful degradation message if AI is unavailable
  if (allFetched && !hasSuggestions && !isLoading) {
    return (
      <div className="mb-4 rounded-3xl border border-slate-200 bg-slate-50/50 backdrop-blur-sm px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span className="text-base">ℹ️</span>
          <span>KI-Vorschläge derzeit nicht verfügbar</span>
        </div>
      </div>
    );
  }

  // Show loading state while fetching
  if (isLoading && !hasSuggestions) {
    return (
      <div className="mb-4 rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm px-4 py-3 shadow-elevated dark:shadow-elevated">
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-nf-primary"></span>
          <span>KI-Vorschläge werden geladen…</span>
        </div>
      </div>
    );
  }

  if (!hasSuggestions) {
    return null;
  }

  return (
    <div className="mb-4 rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm px-4 py-3 shadow-elevated dark:shadow-elevated">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-nf-primary/10 text-nf-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              KI-Vorschläge: {suggestions.length} von {totalTransactions} Buchungen
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Hohe Trefferquote zuerst aufräumen.
            </p>
            {hasHighConfidence && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  Hoch (≥90%): {highConfidence.length}
                </span>
                {mediumConfidence.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                    Mittel (75–89%): {mediumConfidence.length}
                  </span>
                )}
                {lowConfidence.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                    Niedrig (&lt;75%): {lowConfidence.length}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {hasHighConfidence && (
          <div className="flex-shrink-0">
            <button
              type="button"
              onClick={onBatchAccept}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 rounded-full bg-nf-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-nf-primary/90 hover:shadow-glow-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="h-4 w-4" />
              {isProcessing
                ? 'Wird übernommen...'
                : `Alle mit ≥ 90 % übernehmen (${highConfidence.length})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

