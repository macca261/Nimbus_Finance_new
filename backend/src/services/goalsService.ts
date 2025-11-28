import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { Goal } from '@prisma/client';

export type GoalType = 'savings' | 'debt' | 'net_worth';

/**
 * Hybrid goal status interface
 * Represents the status of a hybrid goal that may combine virtual balances
 * (bucket allocations) with external account balances
 */
export interface GoalHybridStatus {
  goalId: string;
  mode: 'simple' | 'hybrid' | 'locked';
  aiAssisted: boolean;
  canToggle: boolean;
  lastEvaluatedAt: string | null; // ISO string
  virtualBalanceCents?: number;
  externalBalanceCents?: number;
  totalProgressCents?: number;
  progressPercent?: number;
}

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

/**
 * Get hybrid status for a goal
 * Tries to query the hybrid goal status view, but falls back gracefully
 * if the view doesn't exist or the goal isn't hybrid-enabled
 */
export async function getHybridStatus(
  goalId: string,
  db: BetterSqliteDatabase,
): Promise<GoalHybridStatus | null> {
  try {
    // First try to query the hybrid goal status view (if it exists)
    try {
      const status = db
        .prepare(`
          SELECT 
            goal_id,
            name,
            target_amount_cents,
            virtual_balance,
            external_balance,
            total_progress_cents
          FROM view_hybrid_goal_status
          WHERE goal_id = ?
        `)
        .get(goalId) as {
          goal_id: string;
          name: string;
          target_amount_cents: number;
          virtual_balance: number;
          external_balance: number;
          total_progress_cents: number;
        } | undefined;

      if (status) {
        return {
          goalId: status.goal_id,
          mode: 'hybrid',
          aiAssisted: false,
          canToggle: true,
          lastEvaluatedAt: new Date().toISOString(),
          virtualBalanceCents: status.virtual_balance || 0,
          externalBalanceCents: status.external_balance || 0,
          totalProgressCents: status.total_progress_cents || 0,
          progressPercent:
            status.target_amount_cents > 0
              ? Math.min(100, (status.total_progress_cents / status.target_amount_cents) * 100)
              : 0,
        };
      }
    } catch (viewError: any) {
      // View doesn't exist or has an error - log but continue to fallback
      // Check if it's a "no such table" or similar error
      const errorMsg = viewError?.message || String(viewError);
      if (process.env.NODE_ENV !== 'production' && !errorMsg.includes('no such table')) {
        console.warn('[goalsService] view_hybrid_goal_status query failed:', errorMsg);
      }
    }

    // Fallback: Verify goal exists and return a simple status
    // Try to query the Goal table directly (Prisma uses "Goal" as table name)
    try {
      // Check multiple possible table names (Prisma vs direct SQL)
      let goal: { id: string; targetCents: number; currentCents: number } | undefined;

      // Try Prisma table name first
      try {
        goal = db
          .prepare(`SELECT id, "targetCents" as targetCents, "currentCents" as currentCents FROM Goal WHERE id = ?`)
          .get(goalId) as any;
      } catch {
        // Try lowercase
        try {
          goal = db
            .prepare(`SELECT id, targetCents, currentCents FROM goal WHERE id = ?`)
            .get(goalId) as any;
        } catch {
          // Try goals (plural)
          goal = db
            .prepare(`SELECT id, targetCents, currentCents FROM goals WHERE id = ?`)
            .get(goalId) as any;
        }
      }

      if (goal) {
        // Return a simple status - goal exists but no hybrid features yet
        const targetCents = goal.targetCents || 0;
        const currentCents = goal.currentCents || 0;
        return {
          goalId: goal.id,
          mode: 'simple',
          aiAssisted: false,
          canToggle: false,
          lastEvaluatedAt: null,
          virtualBalanceCents: 0,
          externalBalanceCents: 0,
          totalProgressCents: currentCents,
          progressPercent: targetCents > 0 ? Math.min(100, (currentCents / targetCents) * 100) : 0,
        };
      }
    } catch (dbError: any) {
      // Table structure might be different - this is expected in some cases
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[goalsService] Could not query goal table:', dbError?.message);
      }
    }

    // Goal not found
    return null;
  } catch (err: any) {
    // Catch any unexpected errors and log them
    console.error('[goalsService] getHybridStatus error:', {
      goalId,
      error: err?.message || String(err),
      stack: err?.stack,
    });
    return null;
  }
}

