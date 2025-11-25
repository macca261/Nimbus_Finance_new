/**
 * GamificationHud Component
 * 
 * A thin horizontal status bar showing rank, XP progress, streak, and next quest.
 * Designed to feel like a game HUD without dominating the Dashboard.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Flame, ArrowRight } from 'lucide-react';
import type { GamificationSummary } from '../../../hooks/useGamificationData';
import clsx from 'clsx';

interface GamificationHudProps {
  data: GamificationSummary | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Get rank display label with emoji/icon
 */
function getRankLabel(rank: GamificationSummary['rank']): string {
  switch (rank) {
    case 'Bronze':
      return 'Bronze Budgeter';
    case 'Silver':
      return 'Silver Saver';
    case 'Gold':
      return 'Gold Guru';
    case 'Platinum':
      return 'Platinum Planner';
    default:
      return 'Bronze Budgeter';
  }
}

/**
 * Get rank color for styling
 */
function getRankColor(rank: GamificationSummary['rank']): string {
  switch (rank) {
    case 'Bronze':
      return 'text-amber-400';
    case 'Silver':
      return 'text-slate-300';
    case 'Gold':
      return 'text-yellow-400';
    case 'Platinum':
      return 'text-cyan-300';
    default:
      return 'text-amber-400';
  }
}

export const GamificationHud: React.FC<GamificationHudProps> = ({
  data,
  isLoading,
  error,
}) => {
  const navigate = useNavigate();

  // Hide HUD if no data and not loading
  if (!isLoading && !data && !error) {
    return null;
  }

  // Loading state - skeleton shimmer
  if (isLoading) {
    return (
      <section className="mb-4 rounded-2xl border border-sky-500/20 bg-gradient-to-r from-sky-950/70 via-sky-900/70 to-sky-950/70 p-4 text-sm text-sky-50 shadow-sm animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-5 w-32 bg-sky-800/50 rounded" />
          <div className="h-5 w-24 bg-sky-800/50 rounded" />
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-sky-900/70" />
      </section>
    );
  }

  // Error state - subtle message
  if (error || !data) {
    return (
      <section className="mb-4 rounded-2xl border border-sky-500/20 bg-gradient-to-r from-sky-950/70 via-sky-900/70 to-sky-950/70 p-4 text-sm text-sky-50/70 shadow-sm">
        <p className="text-xs">Gamification gerade nicht verfügbar</p>
      </section>
    );
  }

  const { rank, xp, xpToNext, level, currentStreakDays, longestStreakDays, nextSuggestedQuest } = data;

  // Calculate XP progress percentage for current rank
  const rankStartXp = rank === 'Bronze' ? 0 : rank === 'Silver' ? 200 : rank === 'Gold' ? 500 : 1000;
  const rankEndXp = rank === 'Bronze' ? 200 : rank === 'Silver' ? 500 : rank === 'Gold' ? 1000 : Infinity;
  const rankXpRange = rankEndXp === Infinity ? xpToNext : rankEndXp - rankStartXp;
  const xpInRank = xp - rankStartXp;
  const xpProgressPercent = rankEndXp === Infinity 
    ? 0 // At max rank, no progress bar
    : Math.min(100, Math.max(0, (xpInRank / rankXpRange) * 100));

  return (
    <section className="mb-4 rounded-2xl border border-sky-500/20 bg-gradient-to-r from-sky-950/70 via-sky-900/70 to-sky-950/70 p-4 text-sm text-sky-50 shadow-sm">
      {/* Top row: Rank & Streak */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Trophy className={clsx('h-4 w-4', getRankColor(rank))} />
          <span className="font-semibold">
            Rang: <span className={getRankColor(rank)}>{getRankLabel(rank)}</span>
          </span>
          <span className="text-xs text-sky-300/70">Level {level}</span>
        </div>
        
        {currentStreakDays > 0 && (
          <div className="flex items-center gap-1.5">
            <Flame 
              className={clsx(
                'h-4 w-4 text-orange-400',
                'motion-reduce:animate-none',
                currentStreakDays > 0 && 'animate-pulse'
              )} 
            />
            <span className="text-xs font-medium">
              Streak: {currentStreakDays} {currentStreakDays === 1 ? 'Tag' : 'Tage'} 🔥
            </span>
          </div>
        )}
      </div>

      {/* Bottom row: XP bar + Quest CTA */}
      <div className="flex items-center gap-4">
        {/* XP Progress Bar */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-sky-200/80">
              {xp} XP
            </span>
            {xpToNext > 0 && (
              <span className="text-xs text-sky-300/70">
                {xpToNext} bis {rank === 'Bronze' ? 'Silver' : rank === 'Silver' ? 'Gold' : 'Platinum'}
              </span>
            )}
            {xpToNext === 0 && (
              <span className="text-xs text-sky-300/70">
                Maximaler Rang
              </span>
            )}
          </div>
          <div className="h-1.5 w-full rounded-full bg-sky-900/70">
            <div
              className="h-1.5 rounded-full bg-sky-400 transition-all duration-500"
              style={{ width: `${xpProgressPercent}%` }}
            />
          </div>
        </div>

        {/* Next Quest CTA */}
        {nextSuggestedQuest && (
          <button
            onClick={() => navigate(nextSuggestedQuest.ctaPath)}
            className="flex items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-800/50 px-3 py-1.5 text-xs font-medium text-sky-100 transition hover:bg-sky-800/70 hover:border-sky-400/50 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-sky-950"
          >
            <span>Nächste Herausforderung: {nextSuggestedQuest.title}</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </section>
  );
};

