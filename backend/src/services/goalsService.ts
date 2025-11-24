import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { Goal } from '@prisma/client';

export type GoalType = 'savings' | 'debt' | 'net_worth';

export interface GoalProgress {
  goal: Goal;
  currentCents: number;
  targetCents: number;
  progressPercent: number;
  remainingCents: number;
  requiredMonthlyCents: number | null; // null if no target date
  projectedCompletionDate: Date | null; // null if can't calculate
  status: 'on_track' | 'behind' | 'ahead' | 'completed' | 'no_target';
}

/**
 * Calculate current amount for a goal based on linked accounts/categories
 */
function calculateGoalCurrent(
  db: BetterSqliteDatabase,
  goal: Goal,
): number {
  // If goal has linked accounts, sum balances from those accounts
  // If goal has linked categories, sum transactions in those categories
  // For now, use the stored currentCents (can be updated manually or via API)
  
  // TODO: Implement automatic calculation based on linkedAccountIds and linkedCategoryIds
  // This would require:
  // 1. Querying account balances if linkedAccountIds is set
  // 2. Summing transactions in linked categories if linkedCategoryIds is set
  // 3. Combining both if both are set
  
  // For v0.9, return the stored value
  // In future, could compute from linkedAccountIds/linkedCategoryIds
  return goal.currentCents;
}

/**
 * Calculate required monthly savings to reach goal by target date
 */
function calculateRequiredMonthly(
  currentCents: number,
  targetCents: number,
  targetDate: Date | null,
): number | null {
  if (!targetDate) return null;
  
  const now = new Date();
  if (targetDate <= now) return null;
  
  const monthsRemaining = Math.max(1, 
    (targetDate.getFullYear() - now.getFullYear()) * 12 + 
    (targetDate.getMonth() - now.getMonth())
  );
  
  const remainingCents = targetCents - currentCents;
  if (remainingCents <= 0) return 0;
  
  return Math.ceil(remainingCents / monthsRemaining);
}

/**
 * Calculate projected completion date based on current progress rate
 */
function calculateProjectedCompletion(
  currentCents: number,
  targetCents: number,
  contributionsHistory: Array<{ date: Date; amountCents: number }>,
): Date | null {
  if (currentCents >= targetCents) {
    return new Date(); // Already completed
  }
  
  if (contributionsHistory.length < 2) {
    return null; // Not enough data
  }
  
  // Calculate average monthly contribution from history
  const sorted = [...contributionsHistory].sort((a, b) => a.date.getTime() - b.date.getTime());
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  
  const monthsElapsed = Math.max(1,
    (last.date.getFullYear() - first.date.getFullYear()) * 12 +
    (last.date.getMonth() - first.date.getMonth())
  );
  
  const totalContributed = sorted.reduce((sum, c) => sum + c.amountCents, 0);
  const avgMonthlyCents = totalContributed / monthsElapsed;
  
  if (avgMonthlyCents <= 0) return null;
  
  const remainingCents = targetCents - currentCents;
  const monthsNeeded = Math.ceil(remainingCents / avgMonthlyCents);
  
  const projected = new Date();
  projected.setMonth(projected.getMonth() + monthsNeeded);
  
  return projected;
}

/**
 * Determine goal status
 */
function determineStatus(
  currentCents: number,
  targetCents: number,
  targetDate: Date | null,
  requiredMonthlyCents: number | null,
  projectedCompletion: Date | null,
): GoalProgress['status'] {
  if (currentCents >= targetCents) {
    return 'completed';
  }
  
  if (!targetDate) {
    return 'no_target';
  }
  
  if (!requiredMonthlyCents || !projectedCompletion) {
    return 'on_track'; // Default if we can't calculate
  }
  
  if (projectedCompletion <= targetDate) {
    return 'ahead';
  } else {
    const monthsBehind = Math.ceil(
      (projectedCompletion.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );
    return monthsBehind > 1 ? 'behind' : 'on_track';
  }
}

/**
 * Calculate goal progress
 */
export function calculateGoalProgress(
  goal: Goal,
  db: BetterSqliteDatabase,
  contributionsHistory: Array<{ date: Date; amountCents: number }> = [],
): GoalProgress {
  const currentCents = calculateGoalCurrent(db, goal);
  const targetCents = goal.targetCents;
  const progressPercent = targetCents > 0 ? Math.min(100, (currentCents / targetCents) * 100) : 0;
  const remainingCents = targetCents - currentCents;
  
  const targetDate = goal.targetDate ? new Date(goal.targetDate) : null;
  const requiredMonthlyCents = calculateRequiredMonthly(currentCents, targetCents, targetDate);
  const projectedCompletion = calculateProjectedCompletion(currentCents, targetCents, contributionsHistory);
  
  const status = determineStatus(currentCents, targetCents, targetDate, requiredMonthlyCents, projectedCompletion);
  
  return {
    goal,
    currentCents,
    targetCents,
    progressPercent,
    remainingCents,
    requiredMonthlyCents,
    projectedCompletionDate: projectedCompletion,
    status,
  };
}

