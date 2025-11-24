import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { Budget, BudgetCategoryAllocation } from '@prisma/client';

export type BudgetPeriod = 'monthly' | 'weekly' | 'yearly';

export interface BudgetCategoryAllocationWithSpent extends BudgetCategoryAllocation {
  spentCents: number;
  remainingCents: number;
  progressPercent: number;
  isOverspent: boolean;
}

export interface BudgetSummary {
  budget: Budget;
  allocations: BudgetCategoryAllocationWithSpent[];
  totalPlannedCents: number;
  totalSpentCents: number;
  totalRemainingCents: number;
  overspendCount: number;
}

/**
 * Get date range for a budget period
 */
function getPeriodDateRange(period: BudgetPeriod, periodValue: string): { start: string; end: string } {
  if (period === 'monthly') {
    // periodValue format: '2025-10'
    const [year, month] = periodValue.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  } else if (period === 'weekly') {
    // periodValue format: '2025-W42' (ISO week)
    const [year, week] = periodValue.split('-W').map(Number);
    const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
    const dow = simple.getUTCDay();
    const ISOweekStart = simple;
    if (dow <= 4) ISOweekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
    else ISOweekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
    const start = ISOweekStart;
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    end.setUTCHours(23, 59, 59, 999);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  } else {
    // yearly: periodValue format: '2025'
    const year = Number(periodValue);
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  }
}

/**
 * Calculate spent amount for a category in a given period
 */
function calculateCategorySpent(
  db: BetterSqliteDatabase,
  categoryId: string,
  startDate: string,
  endDate: string,
): number {
  // Query transactions for this category in the period
  // Only count expenses (negative amounts), exclude internal transfers, pass-through, cash withdrawals
  const row = db
    .prepare(
      `
    SELECT COALESCE(SUM(ABS(amountCents)), 0) AS spentCents
    FROM transactions
    WHERE category = ?
      AND bookingDate BETWEEN ? AND ?
      AND amountCents < 0
      AND (isInternalTransfer = 0 OR isInternalTransfer IS NULL)
      AND (isPassThrough = 0 OR isPassThrough IS NULL)
      AND (isCashWithdrawal = 0 OR isCashWithdrawal IS NULL)
      AND (isReimbursement = 0 OR isReimbursement IS NULL)
  `,
    )
    .get(categoryId, startDate, endDate) as { spentCents: number | null };

  return Math.trunc(row?.spentCents ?? 0);
}

/**
 * Calculate budget summary with spent amounts
 */
export function calculateBudgetSummary(
  budget: Budget & { allocations: BudgetCategoryAllocation[] },
  db: BetterSqliteDatabase,
): BudgetSummary {
  const { start, end } = getPeriodDateRange(budget.period as BudgetPeriod, budget.periodValue);

  const allocationsWithSpent: BudgetCategoryAllocationWithSpent[] = budget.allocations.map((alloc) => {
    const spentCents = calculateCategorySpent(db, alloc.categoryId, start, end);
    const remainingCents = alloc.plannedCents - spentCents;
    const progressPercent = alloc.plannedCents > 0 ? (spentCents / alloc.plannedCents) * 100 : 0;
    const isOverspent = remainingCents < 0;

    return {
      ...alloc,
      spentCents,
      remainingCents,
      progressPercent, // Allow >100% to show overspend visually
      isOverspent,
    };
  });

  const totalPlannedCents = allocationsWithSpent.reduce((sum, a) => sum + a.plannedCents, 0);
  const totalSpentCents = allocationsWithSpent.reduce((sum, a) => sum + a.spentCents, 0);
  const totalRemainingCents = totalPlannedCents - totalSpentCents;
  const overspendCount = allocationsWithSpent.filter((a) => a.isOverspent).length;

  return {
    budget,
    allocations: allocationsWithSpent,
    totalPlannedCents,
    totalSpentCents,
    totalRemainingCents,
    overspendCount,
  };
}

/**
 * Get rollover amount from previous period
 */
export function calculateRollover(
  db: BetterSqliteDatabase,
  categoryId: string,
  currentPeriod: BudgetPeriod,
  currentPeriodValue: string,
): number {
  // For monthly budgets, get previous month's remaining
  if (currentPeriod === 'monthly') {
    const [year, month] = currentPeriodValue.split('-').map(Number);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevPeriodValue = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

    // Find previous budget for this category
    // This would require querying budgets - for now, return 0
    // In a full implementation, we'd query the previous budget's allocation
    return 0;
  }
  return 0;
}

