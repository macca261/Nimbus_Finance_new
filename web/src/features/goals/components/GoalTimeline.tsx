import React from 'react';
import type { GoalProgress } from '../../../types/goals';
import { formatDate } from '../../../lib/format';

interface GoalTimelineProps {
  goals: GoalProgress[];
}

export const GoalTimeline: React.FC<GoalTimelineProps> = ({ goals }) => {
  const sortedGoals = [...goals].sort((a, b) => {
    if (!a.goal.targetDate) return 1;
    if (!b.goal.targetDate) return -1;
    return new Date(a.goal.targetDate).getTime() - new Date(b.goal.targetDate).getTime();
  });

  if (sortedGoals.length === 0) {
    return (
      <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-8 text-center text-nf-text-muted">
        Keine Ziele mit Zieltermin vorhanden.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-6">
      <h3 className="text-base font-semibold text-nf-text-main mb-4">Zeitplan</h3>
      <div className="space-y-3">
        {sortedGoals.map((progress) => (
          <div key={progress.goal.id} className="flex items-center justify-between border-b border-nf-border-subtle pb-3 last:border-0">
            <div>
              <p className="text-sm font-medium text-nf-text-main">{progress.goal.name}</p>
              <p className="text-xs text-nf-text-muted">
                {progress.progressPercent.toFixed(0)}% erreicht
              </p>
            </div>
            {progress.goal.targetDate && (
              <p className="text-xs text-nf-text-muted">{formatDate(progress.goal.targetDate)}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

