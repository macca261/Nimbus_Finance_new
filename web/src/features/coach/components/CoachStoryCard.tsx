import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';
import type { CoachStoryResponse } from '../../../api/coachApi';
import { formatCurrency } from '../../../lib/format';
import clsx from 'clsx';

interface CoachStoryCardProps {
  storyResponse: CoachStoryResponse | null;
  isLoading: boolean;
  error?: Error | null;
  onRefresh?: () => void;
  isFresh?: boolean;
}

/**
 * Maps action text to navigation routes.
 */
function getActionRoute(action: string): string | null {
  const lower = action.toLowerCase();
  if (lower.includes('budget') || lower.includes('haushalt')) {
    return '/budgets';
  }
  if (lower.includes('ziel') || lower.includes('goal') || lower.includes('sparziel')) {
    return '/goals';
  }
  if (lower.includes('abo') || lower.includes('vertrag') || lower.includes('subscription')) {
    return '/insights';
  }
  if (lower.includes('sonstiges') || lower.includes('review')) {
    return '/review';
  }
  if (lower.includes('transaktion') || lower.includes('transaction')) {
    return '/transactions';
  }
  return null;
}

/**
 * Extracts action text for display (removes common prefixes).
 */
function getActionLabel(action: string): string {
  // Remove common prefixes like "Setze ein", "Überprüfe", etc.
  return action
    .replace(/^(Setze ein|Überprüfe|Prüfe|Erstelle|Lege an|Aktualisiere)\s+/i, '')
    .trim();
}

export const CoachStoryCard: React.FC<CoachStoryCardProps> = ({
  storyResponse,
  isLoading,
  error,
  onRefresh,
  isFresh = false,
}) => {
  const navigate = useNavigate();

  // Don't render if disabled
  if (storyResponse?.disabled) {
    return null;
  }

  const story = storyResponse?.story;
  const fallbackMetrics = storyResponse?.fallbackMetrics;
  const isEmpty = storyResponse?.isEmpty;

  return (
    <div
      className={clsx(
        'rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm p-5 sm:p-6 lg:p-7 shadow-elevated',
        'transition-all duration-200 ease-out',
        'hover:scale-[1.01] hover:shadow-lg',
        'motion-reduce:transform-none motion-reduce:shadow-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-nf-bg-card',
        isFresh && 'animate-[nimbusPulse_1.5s_ease-out_0s_3]'
      )}
    >
      {/* Header with title and refresh button */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-nf-primary flex-shrink-0" />
          <div>
            <h3 className="text-base font-semibold text-nf-text-main flex items-center gap-2">
              {story?.title || 'Dein Monat in kurzen Worten'}
              {isFresh && (
                <span className="inline-flex items-center rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-500">
                  Neu
                </span>
              )}
            </h3>
            <p className="text-[11px] text-nf-text-muted mt-0.5">
              {story ? 'KI-generierte Zusammenfassung' : 'Letzte 30 Tage'}
            </p>
          </div>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 rounded-full text-nf-text-muted hover:text-nf-text-main hover:bg-nf-bg-card-subtle transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Aktualisieren"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="py-6 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-nf-text-muted">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Money Coach denkt nach …</span>
          </div>
        </div>
      ) : error ? (
        <div className="py-6 text-center space-y-3">
          <p className="text-sm text-nf-text-muted">
            Die Zusammenfassung konnte nicht geladen werden.
          </p>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-2 rounded-full border border-nf-border-subtle bg-nf-bg-card px-4 py-2 text-sm font-medium text-nf-text-main transition hover:bg-nf-bg-card-subtle"
            >
              <RefreshCw className="h-4 w-4" />
              Erneut versuchen
            </button>
          )}
        </div>
      ) : isEmpty ? (
        <div className="py-6 text-center">
          <p className="text-sm text-nf-text-muted">
            Noch keine Daten – importiere Buchungen, um deine Zusammenfassung zu sehen.
          </p>
        </div>
      ) : story ? (
        <div className="space-y-4">
          {/* Insights */}
          <div className="space-y-2.5">
            {story.insights.map((insight, idx) => (
              <div key={idx} className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-nf-positive mt-0.5 flex-shrink-0" />
                <p className="text-sm text-nf-text-main leading-relaxed flex-1">{insight}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          {story.actions.length > 0 && (
            <div className="pt-2 border-t border-nf-border-subtle/60">
              <div className="flex flex-wrap gap-2">
                {story.actions.map((action, idx) => {
                  const route = getActionRoute(action);
                  const label = getActionLabel(action);
                  
                  if (route) {
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => navigate(route)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-nf-primary/30 bg-nf-primary-soft px-3 py-1.5 text-xs font-medium text-nf-primary transition hover:bg-nf-primary/10 hover:border-nf-primary/50 hover:shadow-sm"
                      >
                        <span>{label}</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    );
                  }
                  
                  return (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-full border border-nf-border-subtle bg-nf-bg-card-subtle px-3 py-1.5 text-xs font-medium text-nf-text-muted"
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : fallbackMetrics ? (
        <div className="space-y-3">
          {fallbackMetrics.topCategory ? (
            <p className="text-sm text-nf-text-main">
              In den letzten 30 Tagen war deine Top-Kategorie{' '}
              <span className="font-semibold">{fallbackMetrics.topCategory}</span> mit{' '}
              <span className="font-semibold">
                {formatCurrency(fallbackMetrics.topCategoryAmountCents / 100)}
              </span>
              .
            </p>
          ) : (
            <p className="text-sm text-nf-text-muted">
              Noch keine Daten – importiere Buchungen, um deine Zusammenfassung zu sehen.
            </p>
          )}
          {fallbackMetrics.topCategory && (
            <>
              {fallbackMetrics.netCents > 0 ? (
                <p className="text-sm text-nf-text-muted">
                  Du hattest einen Überschuss von{' '}
                  <span className="font-medium text-nf-positive">
                    {formatCurrency(fallbackMetrics.netCents / 100)}
                  </span>
                  .
                </p>
              ) : (
                <p className="text-sm text-nf-text-muted">
                  Dein Netto betrug{' '}
                  <span className="font-medium">
                    {formatCurrency(Math.abs(fallbackMetrics.netCents) / 100)}
                  </span>
                  .
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="py-6 text-center">
          <p className="text-sm text-nf-text-muted">
            Noch keine Daten – importiere Buchungen, um deine Zusammenfassung zu sehen.
          </p>
        </div>
      )}
    </div>
  );
};

