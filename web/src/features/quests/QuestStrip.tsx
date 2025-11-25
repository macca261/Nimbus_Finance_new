/**
 * QuestStrip Component
 * 
 * Displays active quests as thin utility widgets that guide users
 * toward better financial organization. Designed for horizontal layout
 * with minimal vertical footprint.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Upload, CheckSquare2 } from 'lucide-react';
import type { Quest, QuestKind } from '../../hooks/useQuests';
import { DashboardWidget } from '../../components/dashboard/DashboardWidget';

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
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map(i => (
          <DashboardWidget key={i} className="h-24">
            <div className="h-full animate-pulse bg-nf-bg-card-subtle rounded" />
          </DashboardWidget>
        ))}
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
    return null; // Don't show empty state - keep dashboard clean
  }

  // Get icon for quest type
  const getQuestIcon = (kind: QuestKind) => {
    switch (kind) {
      case 'IMPORT':
        return <Upload className="h-5 w-5 text-gray-300 flex-shrink-0" />;
      case 'CLEANUP':
        return <CheckSquare2 className="h-5 w-5 text-gray-300 flex-shrink-0" />;
      default:
        return <ArrowRight className="h-5 w-5 text-gray-300 flex-shrink-0" />;
    }
  };

  // Render quest cards as thin horizontal utility widgets
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {quests.map(quest => {
        const progressPercent = getProgressPercent(quest.progressCurrent, quest.progressTarget);
        const hasProgress = quest.progressCurrent !== undefined && quest.progressTarget !== undefined;

        return (
          <DashboardWidget
            key={quest.id}
            onClick={() => navigate(quest.ctaPath ?? quest.cta.href)}
            className="h-24 max-h-24 flex items-center gap-3"
          >
            {/* Icon - Left */}
            <div className="flex-shrink-0">
              {getQuestIcon(quest.kind)}
            </div>

            {/* Content - Middle (flexible) */}
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
              {/* Label */}
              <h3 className="text-xs font-medium uppercase tracking-wider text-gray-300 line-clamp-1">
                {quest.title}
              </h3>

              {/* Description */}
              <p className="text-sm text-white line-clamp-1">
                {quest.description}
              </p>

              {/* Progress indicator (if applicable) */}
              {hasProgress && quest.progressTarget! > 0 && (
                <div className="mt-1">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[10px] text-gray-400">
                      {formatProgress(quest.progressCurrent, quest.progressTarget)}
                    </span>
                    <span className="text-[10px] font-medium text-gray-300 tabular-nums">
                      {Math.round(progressPercent)}%
                    </span>
                  </div>
                  {/* Ultra-thin progress bar */}
                  <div className="h-0.5 w-full rounded-full bg-slate-700/50 overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Action Button - Right */}
            <div className="flex-shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(quest.ctaPath ?? quest.cta.href);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/20 hover:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                <span className="whitespace-nowrap">{quest.cta.label}</span>
                <ArrowRight className="h-3 w-3 flex-shrink-0" />
              </button>
            </div>
          </DashboardWidget>
        );
      })}
    </section>
  );
};

