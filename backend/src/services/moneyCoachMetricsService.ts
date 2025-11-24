import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';
import { calculateBudgetSummary } from './budgetsService';
import { calculateGoalProgress } from './goalsService';
import { getCategoryDefinition } from '../config/categories';

const prisma = new PrismaClient();

export interface MoneyCoachMetrics {
  period: { start: string; end: string };
  prevPeriod?: { start: string; end: string };
  totalIncomeCents: number;
  totalExpenseCents: number;
  netCents: number;
  prevNetCents?: number;
  topCategories: Array<{
    categoryId: string;
    label: string;
    amountCents: number;
    deltaVsPrevCents?: number;
  }>;
  budgetSummary?: {
    totalBudgets: number;
    overspentCount: number;
    underBudgetCount: number;
  };
  goalSummary?: {
    totalGoals: number;
    onTrackCount: number;
    behindCount: number;
  };
  achievementsSummary?: {
    completedCount: number;
    newlyCompletedCount?: number;
  };
  anomalies?: Array<{
    categoryLabel: string;
    amountCents: number;
  }>;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function subtractDays(iso: string, days: number): string {
  const base = new Date(iso);
  if (Number.isNaN(base.getTime())) {
    return isoDaysAgo(days);
  }
  base.setDate(base.getDate() - days);
  return base.toISOString().slice(0, 10);
}

/**
 * Get financial metrics for the Money Coach feature.
 * Aggregates transactions, budgets, goals, and achievements for a given period.
 */
export async function getMoneyCoachMetrics(
  db: BetterSqliteDatabase,
  opts?: { days?: number },
): Promise<MoneyCoachMetrics> {
  const days = opts?.days ?? 30;
  
  // Get date ranges - always use today as reference if no transactions exist
  const latestRow = db
    .prepare(`SELECT MAX(bookingDate) AS latest FROM transactions`)
    .get() as { latest: string | null };
  
  // Use today's date as reference if no transactions exist
  const referenceDate = latestRow?.latest ?? isoDaysAgo(0);
  const periodEnd = referenceDate;
  const periodStart = subtractDays(periodEnd, days);
  
  const prevPeriodEnd = subtractDays(periodStart, 1);
  const prevPeriodStart = subtractDays(prevPeriodEnd, days);

  // Ensure we always return a valid structure, even with 0 transactions

  // Get income and expenses for current period
  const currentPeriodRow = db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN amountCents > 0 THEN amountCents ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN amountCents < 0 THEN amountCents ELSE 0 END), 0) AS expenses
       FROM transactions
       WHERE bookingDate BETWEEN ? AND ?`,
    )
    .get(periodStart, periodEnd) as { income: number; expenses: number };

  // Get income and expenses for previous period
  const prevPeriodRow = db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN amountCents > 0 THEN amountCents ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN amountCents < 0 THEN amountCents ELSE 0 END), 0) AS expenses
       FROM transactions
       WHERE bookingDate BETWEEN ? AND ?`,
    )
    .get(prevPeriodStart, prevPeriodEnd) as { income: number; expenses: number };

  const totalIncomeCents = currentPeriodRow.income;
  const totalExpenseCents = Math.abs(currentPeriodRow.expenses);
  const netCents = totalIncomeCents - totalExpenseCents;
  const prevNetCents = prevPeriodRow.income - Math.abs(prevPeriodRow.expenses);

  // Get top spending categories for current period
  const categoryRows = db
    .prepare(
      `SELECT category AS categoryId, COALESCE(SUM(-amountCents), 0) AS sum
       FROM transactions
       WHERE amountCents < 0
         AND bookingDate BETWEEN ? AND ?
       GROUP BY category`,
    )
    .all(periodStart, periodEnd) as Array<{ categoryId: string | null; sum: number }>;

  // Get top spending categories for previous period (for comparison)
  const prevCategoryRows = db
    .prepare(
      `SELECT category AS categoryId, COALESCE(SUM(-amountCents), 0) AS sum
       FROM transactions
       WHERE amountCents < 0
         AND bookingDate BETWEEN ? AND ?
       GROUP BY category`,
    )
    .all(prevPeriodStart, prevPeriodEnd) as Array<{ categoryId: string | null; sum: number }>;

  const prevCategoryMap = new Map<string, number>();
  for (const row of prevCategoryRows) {
    const catId = row.categoryId || 'other';
    prevCategoryMap.set(catId, row.sum);
  }

  const topCategories = categoryRows
    .map(row => {
      const catId = (row.categoryId || 'other') as string;
      const def = getCategoryDefinition(catId);
      const prevAmount = prevCategoryMap.get(catId) || 0;
      return {
        categoryId: catId,
        label: def.label,
        amountCents: row.sum,
        deltaVsPrevCents: row.sum - prevAmount,
      };
    })
    .filter(cat => cat.amountCents > 0)
    .sort((a, b) => b.amountCents - a.amountCents)
    .slice(0, 3);

  // Get budget summary
  let budgetSummary: MoneyCoachMetrics['budgetSummary'] | undefined;
  try {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const budgets = await prisma.budget.findMany({
      where: {
        period: 'monthly',
        periodValue: currentMonth,
      },
      include: {
        allocations: true,
      },
    });

    if (budgets.length > 0) {
      let overspentCount = 0;
      let underBudgetCount = 0;

      for (const budget of budgets) {
        const summary = calculateBudgetSummary(budget, db);
        if (summary.overspendCount > 0) {
          overspentCount++;
        }
        const allUnderBudget = summary.allocations.every(alloc => !alloc.isOverspent);
        if (allUnderBudget && summary.totalSpentCents < summary.totalPlannedCents) {
          underBudgetCount++;
        }
      }

      budgetSummary = {
        totalBudgets: budgets.length,
        overspentCount,
        underBudgetCount,
      };
    }
  } catch (error) {
    console.warn('[moneyCoachMetrics] Failed to fetch budgets:', error);
  }

  // Get goal summary
  let goalSummary: MoneyCoachMetrics['goalSummary'] | undefined;
  try {
    const goals = await prisma.goal.findMany({
      where: { isActive: true },
    });

    if (goals.length > 0) {
      let onTrackCount = 0;
      let behindCount = 0;

      for (const goal of goals) {
        const progress = calculateGoalProgress(goal, db);
        if (progress.status === 'on_track' || progress.status === 'ahead') {
          onTrackCount++;
        } else if (progress.status === 'behind') {
          behindCount++;
        }
      }

      goalSummary = {
        totalGoals: goals.length,
        onTrackCount,
        behindCount,
      };
    }
  } catch (error) {
    console.warn('[moneyCoachMetrics] Failed to fetch goals:', error);
  }

  // Get achievements summary (simplified - based on dashboard achievements)
  const achievementsSummary: MoneyCoachMetrics['achievementsSummary'] = {
    completedCount: 0,
    newlyCompletedCount: 0,
  };

  // Simple achievement checks (matching dashboard logic)
  const netPositive = netCents > 0;
  if (netPositive) {
    achievementsSummary.completedCount++;
  }

  // Check for three positive months
  const threeMonthsRows = db
    .prepare(
      `SELECT
        strftime('%Y-%m', bookingDate) AS month,
        SUM(amountCents) AS net
       FROM transactions
       GROUP BY month
       ORDER BY month DESC
       LIMIT 3`,
    )
    .all() as Array<{ month: string; net: number }>;

  const threePositiveMonths = threeMonthsRows.length === 3 && threeMonthsRows.every(row => row.net > 0);
  if (threePositiveMonths) {
    achievementsSummary.completedCount++;
  }

  // Get anomalies (categories with unusually high spending)
  // Simple heuristic: categories where spending is >2x the average of top categories
  const anomalies: MoneyCoachMetrics['anomalies'] = [];
  if (topCategories.length > 0) {
    const avgSpending = topCategories.reduce((sum, cat) => sum + cat.amountCents, 0) / topCategories.length;
    const threshold = avgSpending * 2;

    for (const cat of topCategories) {
      if (cat.amountCents > threshold && cat.amountCents > 50000) { // At least 500 EUR
        anomalies.push({
          categoryLabel: cat.label,
          amountCents: cat.amountCents,
        });
      }
    }
  }

  // Always return a valid structure, even with 0 transactions
  return {
    period: { start: periodStart, end: periodEnd },
    prevPeriod: { start: prevPeriodStart, end: prevPeriodEnd },
    totalIncomeCents: totalIncomeCents || 0,
    totalExpenseCents: totalExpenseCents || 0,
    netCents: netCents || 0,
    prevNetCents: prevNetCents ?? 0,
    topCategories: topCategories || [],
    budgetSummary,
    goalSummary,
    achievementsSummary: achievementsSummary || { completedCount: 0, newlyCompletedCount: 0 },
    anomalies: anomalies.length > 0 ? anomalies : undefined,
  };
}

