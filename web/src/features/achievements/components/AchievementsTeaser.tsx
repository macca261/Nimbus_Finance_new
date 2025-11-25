import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, ArrowRight } from 'lucide-react';
import { useAchievements } from '../../../hooks/useAchievements';
import type { Achievement } from '../../../types/achievements';
import clsx from 'clsx';

interface AchievementsTeaserProps {
  isFresh?: boolean;
}

export const AchievementsTeaser: React.FC<AchievementsTeaserProps> = ({ isFresh = false }) => {
  const { achievements, isLoading } = useAchievements();

  const featuredAchievements = useMemo(() => {
    if (!achievements || achievements.length === 0) return [];

    // Prioritize: completed (recent), then in_progress (high progress), then locked
    const sorted = [...achievements].sort((a, b) => {
      // Completed achievements first (by unlockedAt date, most recent first)
      if (a.status === 'completed' && b.status === 'completed') {
        const aDate = a.unlockedAt ? new Date(a.unlockedAt).getTime() : 0;
        const bDate = b.unlockedAt ? new Date(b.unlockedAt).getTime() : 0;
        return bDate - aDate;
      }
      if (a.status === 'completed') return -1;
      if (b.status === 'completed') return 1;

      // Then in_progress by progress (highest first)
      if (a.status === 'in_progress' && b.status === 'in_progress') {
        return b.progress - a.progress;
      }
      if (a.status === 'in_progress') return -1;
      if (b.status === 'in_progress') return 1;

      // Locked last
      return 0;
    });

    // Take top 2
    return sorted.slice(0, 2);
  }, [achievements]);

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card shadow-elevated p-5 animate-pulse">
        <div className="h-4 w-32 bg-nf-bg-card-subtle rounded mb-3" />
        <div className="h-3 w-48 bg-nf-bg-card-subtle rounded" />
      </div>
    );
  }

  if (featuredAchievements.length === 0) {
    return null;
  }

  const primary = featuredAchievements[0];
  const secondary = featuredAchievements[1];

  const getProgressText = (achievement: Achievement) => {
    if (achievement.status === 'completed') {
      return 'Abgeschlossen! 🎉';
    }
    if (achievement.status === 'locked') {
      return 'Noch gesperrt';
    }
    const remaining = 100 - achievement.progress;
    if (remaining <= 5) {
      return `Noch ${Math.ceil(remaining)}% bis zum Erfolg!`;
    }
    return `${achievement.progress}% erreicht`;
  };

  return (
    <div
      className={clsx(
        'rounded-3xl border border-nf-border-subtle bg-nf-bg-card shadow-elevated p-5',
        'transition-all duration-200 ease-out',
        'hover:scale-[1.01] hover:shadow-lg',
        'motion-reduce:transform-none motion-reduce:shadow-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-nf-bg-card',
        isFresh && 'animate-[nimbusPulse_1.5s_ease-out_0s_3]'
      )}
    >
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-nf-primary" />
        <h3 className="text-sm font-semibold text-nf-text-main">Deine Erfolge</h3>
      </div>

      <div className="space-y-3">
        {/* Primary achievement */}
        <div>
          <p className="text-xs font-medium text-nf-text-main mb-1">{primary.title}</p>
          {primary.status !== 'locked' && (
            <div className="space-y-1">
              <div className="h-1.5 bg-nf-bg-card-subtle rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    primary.status === 'completed' ? 'bg-nf-positive' : 'bg-nf-primary'
                  }`}
                  style={{ width: `${Math.min(100, primary.progress)}%` }}
                />
              </div>
              <p className="text-[11px] text-nf-text-muted">{getProgressText(primary)}</p>
            </div>
          )}
          {primary.status === 'locked' && (
            <p className="text-[11px] text-nf-text-muted">Erfolg noch nicht freigeschaltet</p>
          )}
        </div>

        {/* Secondary achievement (if available) */}
        {secondary && (
          <div className="pt-3 border-t border-nf-border-subtle">
            <p className="text-xs font-medium text-nf-text-main mb-1">{secondary.title}</p>
            {secondary.status !== 'locked' && (
              <div className="space-y-1">
                <div className="h-1.5 bg-nf-bg-card-subtle rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      secondary.status === 'completed' ? 'bg-nf-positive' : 'bg-nf-primary'
                    }`}
                    style={{ width: `${Math.min(100, secondary.progress)}%` }}
                  />
                </div>
                <p className="text-[11px] text-nf-text-muted">{getProgressText(secondary)}</p>
              </div>
            )}
            {secondary.status === 'locked' && (
              <p className="text-[11px] text-nf-text-muted">Erfolg noch nicht freigeschaltet</p>
            )}
          </div>
        )}
      </div>

      <Link
        to="/achievements"
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-nf-primary hover:text-nf-primary/80 transition-colors"
      >
        Alle Erfolge ansehen
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
};

