/**
 * QuestStrip Component
 * 
 * Displays 0-3 active quests as compact cards/chips that guide users
 * toward better financial organization. Makes Nimbus feel more game-like.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import type { Quest } from '../../hooks/useQuests';

interface QuestStripProps {
  quests: Quest[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

/**
 * Calculate progress percentage for display
 */
function getProgressPercent(current?: number, target?: number): number {
  if (current === undefined || target === undefined || target === 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, (current / target) * 100));
}

/**
 * Format progress text (e.g., "3 / 10 geschafft")
 */
function formatProgress(current?: number, target?: number): string {
  if (current === undefined || target === undefined) {
    return '';
  }
  return `${current} / ${target} geschafft`;
}

export const QuestStrip: React.FC<QuestStripProps> = ({
  quests,
  isLoading = false,
  error = null,
  onRefresh,
}) => {
  const navigate = useNavigate();

  // Loading state: show skeleton chips
  if (isLoading) {
    return (
      <section className="mb-6">
        <div className="flex flex-wrap gap-3">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-20 w-full sm:w-[calc(50%-0.375rem)] lg:w-[calc(33.333%-0.5rem)] rounded-2xl border border-nf-border-subtle bg-nf-bg-card-subtle animate-pulse"
            />
          ))}
        </div>
      </section>
    );
  }

  // Error state: show nothing (graceful degradation)
  if (error) {
    if (import.meta.env.DEV) {
      console.debug('[QuestStrip] Error loading quests:', error);
    }
    return null; // Don't show error to user, just fail silently
  }

  // Empty state: show subtle "all done" message (optional)
  if (quests.length === 0) {
    return (
      <section className="mb-6">
        <div className="rounded-2xl border border-emerald-200/50 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-500/10 px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            <span>Alles erledigt 🎉</span>
          </div>
        </div>
      </section>
    );
  }

  // Render quest cards
  return (
    <section className="mb-6">
      <div className="flex flex-wrap gap-3">
        {quests.map(quest => {
          const progressPercent = getProgressPercent(quest.progressCurrent, quest.progressTarget);
          const hasProgress = quest.progressCurrent !== undefined && quest.progressTarget !== undefined;

          return (
            <div
              key={quest.id}
              className="group relative w-full sm:w-[calc(50%-0.375rem)] lg:w-[calc(33.333%-0.5rem)] rounded-2xl border border-nf-border-subtle bg-nf-bg-card p-4 shadow-card transition-all duration-200 hover:-translate-y-[1px] hover:border-nf-primary/30 hover:shadow-elevated"
            >
              {/* Title */}
              <h3 className="text-sm font-semibold text-nf-text-main mb-1.5 line-clamp-1">
                {quest.title}
              </h3>

              {/* Description */}
              <p className="text-xs text-nf-text-muted mb-3 line-clamp-2 min-h-[2.5rem]">
                {quest.description}
              </p>

              {/* Progress indicator (if applicable) */}
              {hasProgress && quest.progressTarget! > 0 && (
                <div className="mb-3">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[11px] text-nf-text-soft">
                      {formatProgress(quest.progressCurrent, quest.progressTarget)}
                    </span>
                    <span className="text-[11px] font-medium text-nf-text-muted tabular-nums">
                      {Math.round(progressPercent)}%
                    </span>
                  </div>
                  {/* Tiny progress bar */}
                  <div className="h-1.5 w-full rounded-full bg-nf-bg-card-subtle overflow-hidden">
                    <div
                      className="h-full bg-nf-primary transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* CTA Button */}
              <button
                type="button"
                onClick={() => navigate(quest.ctaPath ?? quest.cta.href)}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-nf-primary px-3 py-2 text-xs font-medium text-white transition hover:bg-nf-primary/90 hover:shadow-glow-primary focus:outline-none focus:ring-2 focus:ring-nf-primary focus:ring-offset-2"
              >
                <span>{quest.cta.label}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};

