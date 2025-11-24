import React from 'react';
import CategoryControl from '../CategoryControl';
import { AiCategorySuggestionBadge } from './AiCategorySuggestionBadge';
import { useAiCategorySuggestion } from '../../hooks/useAiCategorySuggestion';
import { formatCurrency } from '../../lib/format';
import { getTransactionDisplayName } from '../../lib/transactions/displayName';
import type { ReviewTransaction, CategoryMeta } from '../../api/reviewApi';
import { fetchSubscriptionCandidates, type SubscriptionCandidate } from '../../lib/api/subscriptions';
import { isAiCategorizationEnabled } from '../../api/aiCategoryApi';

export interface AiSuggestionData {
  transactionId: string;
  suggestion: import('../../api/aiCategoryApi').AiCategorySuggestion | null;
  isLoading: boolean;
  hasFetched: boolean;
}

interface SonstigesTransactionRowProps {
  tx: ReviewTransaction;
  categories: { [id: string]: CategoryMeta };
  getSubscriptionCandidate: (tx: ReviewTransaction) => SubscriptionCandidate | null;
  onCategoryChange: (txId: string, newCategory: string) => void;
  onHide: (txId: string) => void;
  onSuggestionDataChange?: (data: AiSuggestionData) => void;
  WhyButton: React.ComponentType<{ tx: ReviewTransaction }>;
  batchSuggestion?: import('../../api/aiCategoryApi').AiCategorySuggestion | null | undefined; // undefined = not attempted, null = attempted but no suggestion, AiCategorySuggestion = has suggestion
  batchHasAttempted?: boolean; // Whether batch has attempted to fetch for this transaction
}

export const SonstigesTransactionRow: React.FC<SonstigesTransactionRowProps> = ({
  tx,
  categories,
  getSubscriptionCandidate,
  onCategoryChange,
  onHide,
  onSuggestionDataChange,
  WhyButton,
  batchSuggestion,
  batchHasAttempted = false,
}) => {
  const source = tx.categorySource ?? 'unbekannt';
  const confidence = tx.categoryConfidence ?? 0;
  const isLow = confidence < 0.4;
  const isMedium = confidence >= 0.4 && confidence < 0.8;
  const amountCents = tx.amountCents ?? 0;

  // AI suggestion: prefer batch suggestion if available, otherwise use hook as fallback
  // In Sonstiges cleanup context, we want AI suggestions for all transactions that are eligible
  // 
  // Determine if batch has attempted to fetch for this transaction:
  // - batchSuggestion can be: null (no suggestion) or AiCategorySuggestion (has suggestion)
  // - batchHasAttempted prop tells us if batch has attempted (distinguishes "not attempted" from "attempted but null")
  // - Enable per-row hook only if batch hasn't attempted yet (as fallback for rate limits/failures)
  // - This ensures we show "no suggestion" badge when batch returns null, not retry with per-row hook
  const batchSuggestionResult = batchSuggestion; // Can be: null (no suggestion) or AiCategorySuggestion (has suggestion)
  const batchHasAttemptedForThisTx = batchHasAttempted; // Use prop to know if batch attempted (more reliable than inferring from null)
  
  const aiSuggestionHook = useAiCategorySuggestion({
    transactionId: tx.id,
    category: tx.category,
    categoryConfidence: confidence,
    enabled: !batchHasAttemptedForThisTx, // Only use hook if batch hasn't attempted yet (fallback)
  });

  // Use batch suggestion if batch has attempted, otherwise fall back to hook
  // This ensures we show "no suggestion" badge when batch returns null, not just when hook fails
  const aiSuggestion = batchHasAttemptedForThisTx ? batchSuggestionResult : aiSuggestionHook.suggestion;

  // Memoize the suggestion data to avoid creating new objects on every render
  // hasFetched should be true if either batch has attempted OR per-row hook has fetched
  // This ensures the badge shows "no suggestion" state when batch returns null
  const suggestionData = React.useMemo<AiSuggestionData>(() => ({
    transactionId: tx.id,
    suggestion: aiSuggestion,
    isLoading: !batchHasAttemptedForThisTx ? aiSuggestionHook.isLoading : false,
    hasFetched: batchHasAttemptedForThisTx || aiSuggestionHook.hasFetched,
  }), [
    tx.id,
    aiSuggestion?.categoryId, // Only depend on meaningful fields
    aiSuggestion?.confidence,
    batchSuggestionResult?.categoryId,
    batchSuggestionResult?.confidence,
    batchHasAttemptedForThisTx,
    !batchHasAttemptedForThisTx ? aiSuggestionHook.isLoading : false,
    batchHasAttemptedForThisTx || aiSuggestionHook.hasFetched,
  ]);

  // Report suggestion data to parent ONLY when meaningful data changes
  // Use a ref to track the last reported data to avoid unnecessary callbacks
  const lastReportedRef = React.useRef<AiSuggestionData | null>(null);
  
  React.useEffect(() => {
    if (!onSuggestionDataChange) return;
    
    const last = lastReportedRef.current;
    
    // Only call callback if meaningful data has changed
    if (!last ||
        last.suggestion?.categoryId !== suggestionData.suggestion?.categoryId ||
        last.suggestion?.confidence !== suggestionData.suggestion?.confidence ||
        last.isLoading !== suggestionData.isLoading ||
        last.hasFetched !== suggestionData.hasFetched) {
      lastReportedRef.current = suggestionData;
      onSuggestionDataChange(suggestionData);
    }
  }, [suggestionData, onSuggestionDataChange]);

  return (
    <div
      key={tx.id}
      data-transaction-id={tx.id}
      className="pt-3 transition-opacity duration-150"
    >
      <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm px-3 py-2.5 md:px-4 md:py-3 shadow-elevated transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-nf-primary/40 hover:shadow-2xl hover:ring-2 hover:ring-nf-primary/20 dark:shadow-elevated">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          {/* Left: Date + Merchant/Purpose */}
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {tx.bookingDate}
            </span>
            <span className="text-sm md:text-[15px] font-medium text-slate-900 dark:text-slate-50 truncate">
              {getTransactionDisplayName(tx)}
            </span>
            {tx.categoryExplanation?.matchedText && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {tx.categoryExplanation.matchedText}
              </span>
            )}
          </div>

          {/* Middle: Category pill + tags */}
          <div className="mt-1 md:mt-0 md:flex-1 flex flex-wrap items-center gap-1.5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <CategoryControl
                  id={tx.id}
                  fingerprintInput={{
                    bookingDate: tx.bookingDate,
                    valueDate: tx.bookingDate,
                    amountCents: tx.amountCents,
                    currency: tx.currency,
                    purpose: tx.rawText,
                    counterpartName: tx.categoryExplanation?.merchantName ?? null,
                    accountIban: null,
                  }}
                  category={tx.category}
                  categorySource={tx.categorySource}
                  rawText={tx.rawText}
                  merchant={tx.categoryExplanation?.merchantName ?? null}
                  onApplied={async (_resolvedId, next) => {
                    const previousCategoryId = tx.category;
                    onCategoryChange(tx.id, next);
                    
                    // If we successfully changed away from "Sonstiges", hide it from this queue
                    const isPreviouslyOther = !previousCategoryId || previousCategoryId === 'other';
                    const isNowOther = !next || next === 'other';
                    
                    if (isPreviouslyOther && !isNowOther) {
                      onHide(tx.id);
                    }
                  }}
                />
                {(() => {
                  const candidate = getSubscriptionCandidate(tx);
                  if (!candidate) return null;
                  return (
                    <button
                      type="button"
                      onClick={(e) => {
                        // Find the CategoryControl select element and set it to subscriptions
                        const button = e.currentTarget;
                        const row = button.closest('[data-transaction-id]');
                        if (row) {
                          const select = row.querySelector('select') as HTMLSelectElement | null;
                          if (select) {
                            select.value = 'subscriptions';
                            select.dispatchEvent(new Event('change', { bubbles: true }));
                          }
                        }
                      }}
                      className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 transition hover:bg-indigo-100 hover:border-indigo-300 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
                      title={`Mögliches Abo: ${candidate.displayName} (${candidate.frequency === 'monthly' ? 'monatlich' : 'jährlich'})`}
                    >
                      Abo?
                    </button>
                  );
                })()}
              </div>
            </div>
            {/* AI Category Suggestion Badge */}
            {/* Always render badge - it will show suggestion, loading state, or "no suggestion" message */}
            <AiCategorySuggestionBadge
              suggestion={aiSuggestion}
              categoryLabel={aiSuggestion ? (categories[aiSuggestion.categoryId]?.labelDe || aiSuggestion.categoryId) : undefined}
              onAccept={aiSuggestion ? (async (suggestedCategoryId) => {
                // Determine if suggestion came from batch or per-row hook
                const isFromBatch = batchHasAttemptedForThisTx && batchSuggestionResult !== null;
                
                // Update the transaction category
                const previousCategoryId = tx.category;
                onCategoryChange(tx.id, suggestedCategoryId);
                
                // Send feedback
                if (isFromBatch) {
                  // For batch suggestions, send feedback directly
                  try {
                    await fetch('/api/ai/category-feedback', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        transactionId: tx.id,
                        suggestedCategoryId,
                        accepted: true,
                      }),
                    });
                  } catch {
                    // Feedback is not critical
                  }
                } else {
                  // For per-row hook suggestions, use the hook's handler
                  if (aiSuggestionHook.handleAccept) {
                    await aiSuggestionHook.handleAccept(suggestedCategoryId);
                  }
                }
                
                // If we successfully changed away from "Sonstiges", hide it from this queue
                const isPreviouslyOther = !previousCategoryId || previousCategoryId === 'other';
                const isNowOther = !suggestedCategoryId || suggestedCategoryId === 'other';
                
                if (isPreviouslyOther && !isNowOther) {
                  onHide(tx.id);
                }
              }) : undefined}
              onDismiss={aiSuggestion ? (() => {
                // Determine if suggestion came from batch or per-row hook
                const isFromBatch = batchHasAttemptedForThisTx && batchSuggestionResult !== null;
                
                if (isFromBatch) {
                  // For batch suggestions, send feedback directly
                  void fetch('/api/ai/category-feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      transactionId: tx.id,
                      suggestedCategoryId: aiSuggestion.categoryId,
                      accepted: false,
                    }),
                  }).catch(() => {
                    // Feedback is not critical
                  });
                } else {
                  // For per-row hook suggestions, use the hook's handler
                  if (aiSuggestionHook.handleDismiss) {
                    aiSuggestionHook.handleDismiss();
                  }
                }
              }) : undefined}
              isLoading={!batchHasAttemptedForThisTx ? aiSuggestionHook.isLoading : false}
              hasFetched={batchHasAttemptedForThisTx || aiSuggestionHook.hasFetched}
            />
            {/* Dev-only: Show when AI is disabled */}
            {process.env.NODE_ENV === 'development' && !isAiCategorizationEnabled() && (
              <span className="text-xs text-slate-400 italic">KI-Vorschläge deaktiviert</span>
            )}
            {/* Source tag */}
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
              source === 'rule' ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300' :
              source === 'user' ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
              source === 'ml' ? 'bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' :
              'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}>
              {source === 'rule' && 'Regel'}
              {source === 'user' && 'Manuell'}
              {source === 'ml' && 'ML'}
              {source === 'fallback' && 'Fallback'}
              {source === 'unknown' && 'Unbekannt'}
              {!['rule','user','ml','fallback','unknown'].includes(source) && source}
            </span>
          </div>

          {/* Right: Confidence + Actions */}
          <div className="flex items-center justify-between gap-2 md:flex-col md:items-end md:justify-center">
            <div className="flex flex-col items-end gap-1.5">
              {/* Amount (if available) */}
              {amountCents !== undefined && amountCents !== 0 && (
                <span
                  className={`text-sm md:text-base font-semibold tabular-nums ${
                    amountCents < 0
                      ? 'text-slate-900 dark:text-slate-50'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {amountCents < 0 ? '–' : '+'}{formatCurrency(Math.abs(amountCents) / 100)}
                </span>
              )}
              
              {/* Confidence indicator */}
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      isLow ? 'bg-red-400 dark:bg-red-500' : isMedium ? 'bg-yellow-400 dark:bg-yellow-500' : 'bg-green-400 dark:bg-green-500'
                    }`}
                    style={{ width: `${Math.round(confidence * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {Math.round(confidence * 100)}%
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap justify-end gap-1">
              <WhyButton tx={tx} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

