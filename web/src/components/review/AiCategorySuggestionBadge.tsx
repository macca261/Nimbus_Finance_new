import React from 'react';
import { Lightbulb, Check, X } from 'lucide-react';
import type { AiCategorySuggestion } from '../../api/aiCategoryApi';

interface AiCategorySuggestionBadgeProps {
  suggestion: AiCategorySuggestion | null;
  categoryLabel?: string;
  onAccept?: (categoryId: string) => void;
  onDismiss?: () => void;
  isLoading?: boolean;
  hasFetched?: boolean;
}

export const AiCategorySuggestionBadge: React.FC<AiCategorySuggestionBadgeProps> = ({
  suggestion,
  categoryLabel,
  onAccept,
  onDismiss,
  isLoading = false,
  hasFetched = false,
}) => {
  // Show loading skeleton while fetching
  if (isLoading || (!hasFetched && !suggestion)) {
    return (
      <div className="mt-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400"></span>
          <span>KI-Vorschlag wird geladen…</span>
        </div>
      </div>
    );
  }

  // Show empty state if no suggestion and has been fetched
  // This indicates AI was checked but couldn't provide a confident suggestion
  if (!suggestion && hasFetched) {
    return (
      <div className="mt-2">
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
          Keine sichere KI-Einschätzung
        </span>
      </div>
    );
  }

  const confidencePercent = Math.round(suggestion.confidence * 100);

  return (
    <div className="mt-2 rounded-2xl border border-nf-primary/30 bg-nf-primary-soft px-3 py-2.5 shadow-sm">
      <div className="flex items-start gap-2">
        <Lightbulb className="h-4 w-4 text-nf-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-nf-text-main">
              💡 Vorschlag:
            </span>
            <span className="text-xs font-semibold text-nf-primary">
              {categoryLabel || suggestion.categoryId}
            </span>
            <span className="text-[11px] text-nf-text-muted">
              ({confidencePercent}%)
            </span>
          </div>
          {suggestion.reasoning && (
            <p className="mt-1 text-[11px] text-nf-text-muted line-clamp-2">
              {suggestion.reasoning}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            {onAccept && (
              <button
                onClick={() => onAccept(suggestion.categoryId)}
                disabled={isLoading}
                className="inline-flex items-center gap-1 rounded-full bg-nf-primary px-3 py-1 text-[11px] font-medium text-white transition hover:bg-nf-primary/90 hover:shadow-glow-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="h-3 w-3" />
                {isLoading ? 'Wird übernommen...' : 'Übernehmen'}
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                disabled={isLoading}
                className="inline-flex items-center gap-1 rounded-full border border-nf-border-subtle bg-nf-bg-card px-2.5 py-1 text-[11px] font-medium text-nf-text-muted transition hover:bg-nf-bg-card-subtle disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

