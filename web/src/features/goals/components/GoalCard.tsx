import React from 'react';
import type { GoalProgress } from '../../../types/goals';
import { formatCurrency, formatDate } from '../../../lib/format';
import { Edit } from 'lucide-react';

interface GoalCardProps {
  progress: GoalProgress;
  onEdit?: (goalId: string) => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({ progress, onEdit }) => {
  const { goal, currentCents, targetCents, progressPercent, remainingCents, status, projectedCompletionDate } =
    progress;

  const statusColors = {
    on_track: 'text-nf-positive',
    behind: 'text-nf-negative',
    ahead: 'text-nf-positive',
    completed: 'text-nf-positive',
    no_target: 'text-nf-text-muted',
  };

  const statusLabels = {
    on_track: 'Auf Kurs',
    behind: 'Hinterher',
    ahead: 'Voraus',
    completed: 'Abgeschlossen',
    no_target: 'Kein Ziel',
  };

  return (
    <div className="group relative rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-6 shadow-elevated transition-all hover:-translate-y-[1px] hover:shadow-xl">
      {onEdit && (
        <button
          type="button"
          onClick={() => onEdit(goal.id)}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-nf-text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-nf-bg-card-subtle"
        >
          <Edit className="h-4 w-4" />
        </button>
      )}

      <div className="mb-4">
        <h3 className="text-base font-semibold text-nf-text-main mb-1">{goal.name}</h3>
        {goal.description && (
          <p className="text-xs text-nf-text-muted line-clamp-2">{goal.description}</p>
        )}
      </div>

      <div className="mb-4">
        <div className="flex items-baseline gap-2 mb-2">
          <p className="text-3xl font-bold tabular-nums text-nf-text-main">
            {formatCurrency(currentCents / 100)}
          </p>
          <p className="text-sm text-nf-text-muted">von {formatCurrency(targetCents / 100)}</p>
        </div>
        <div className="h-2 bg-nf-bg-card-subtle rounded-full overflow-hidden">
          <div
            className="h-full bg-nf-primary transition-all"
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>
        <p className="text-xs text-nf-text-muted mt-1">{progressPercent.toFixed(0)}% erreicht</p>
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-nf-text-muted">Verbleibend:</span>
          <span className="font-medium text-nf-text-main">{formatCurrency(Math.abs(remainingCents) / 100)}</span>
        </div>
        {goal.targetDate && (
          <div className="flex items-center justify-between">
            <span className="text-nf-text-muted">Zieltermin:</span>
            <span className="font-medium text-nf-text-main">{formatDate(goal.targetDate)}</span>
          </div>
        )}
        {projectedCompletionDate && (
          <div className="flex items-center justify-between">
            <span className="text-nf-text-muted">Prognose:</span>
            <span className="font-medium text-nf-text-main">{formatDate(projectedCompletionDate)}</span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-nf-border-subtle">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium ${statusColors[status]}`}>
          {statusLabels[status]}
        </span>
      </div>
    </div>
  );
};

