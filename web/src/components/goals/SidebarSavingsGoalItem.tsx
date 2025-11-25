/**
 * SidebarSavingsGoalItem Component
 * 
 * Individual goal item in the sidebar with drag-and-drop support.
 * Extracted from SidebarSavingsGoals to fix React Hooks order violations.
 */

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Building2, TrendingUp, AlertCircle } from 'lucide-react';
import { HybridProgressBar } from './HybridProgressBar';

export interface GoalProgress {
  goal: {
    id: string;
    name: string;
    type: string;
    targetCents: number;
    buildingHealth?: number;
    buildingLevel?: number;
    linkedBucketId?: string | null;
  };
  currentCents: number;
  progressPercent: number;
  status: 'on_track' | 'behind' | 'completed';
}

export interface SidebarSavingsGoalItemProps {
  goalProgress: GoalProgress;
  hybridStatus: {
    virtualBalanceCents: number;
    externalBalanceCents: number;
  };
}

export const SidebarSavingsGoalItem: React.FC<SidebarSavingsGoalItemProps> = ({
  goalProgress,
  hybridStatus,
}) => {
  const goal = goalProgress.goal;
  const health = goal.buildingHealth ?? 100;
  const level = goal.buildingLevel ?? 1;

  const virtualBalance = hybridStatus.virtualBalanceCents || 0;
  const externalBalance = hybridStatus.externalBalanceCents || 0;

  // useDroppable is safe here because it's called at the top level of this component
  const { setNodeRef, isOver } = useDroppable({
    id: `goal-${goal.id}`,
    data: {
      type: 'goal',
      goal: {
        id: goal.id,
        name: goal.name,
        bucketId: goal.linkedBucketId,
      },
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`group rounded-xl border p-3 transition ${
        isOver
          ? 'border-green-500 bg-green-500/10'
          : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-slate-600'
      }`}
    >
      {/* Goal Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-white truncate">
            {goal.name}
          </h4>
          <div className="flex items-center gap-2 mt-1">
            {/* Building Icon with Health Indicator */}
            <div className="relative">
              <Building2
                className={`h-4 w-4 ${
                  health >= 80
                    ? 'text-green-400'
                    : health >= 50
                    ? 'text-yellow-400'
                    : 'text-red-400'
                }`}
              />
              {health < 100 && (
                <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </div>
            <span className="text-xs text-slate-400">
              Level {level} • {health}% Gesundheit
            </span>
          </div>
        </div>
      </div>

      {/* Hybrid Progress Bar */}
      <HybridProgressBar
        external={externalBalance}
        virtual={virtualBalance}
        target={goal.targetCents}
        className="mb-2"
      />

      {/* Status Indicators */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-slate-400">
          {goalProgress.status === 'on_track' && (
            <>
              <TrendingUp className="h-3 w-3 text-green-400" />
              <span>Auf Kurs</span>
            </>
          )}
          {goalProgress.status === 'behind' && (
            <>
              <AlertCircle className="h-3 w-3 text-yellow-400" />
              <span>Zurück</span>
            </>
          )}
          {goalProgress.status === 'completed' && (
            <>
              <TrendingUp className="h-3 w-3 text-green-400" />
              <span>Abgeschlossen</span>
            </>
          )}
        </div>
        <span className="text-slate-500">
          {Math.round(goalProgress.progressPercent)}%
        </span>
      </div>

      {/* Drop Zone Hint */}
      {isOver && (
        <div className="mt-2 text-xs text-green-400 text-center animate-pulse">
          Hier ablegen, um zuzuweisen
        </div>
      )}
    </div>
  );
};

