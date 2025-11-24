import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import { getMonthRange } from '../lib/dates';
import { getCategoryDefinition } from '../config/categories';
import type { CategoryId } from '../config/categories';
import { computeTransactionDisplayName } from '../lib/transactions/displayName';

export interface MonthSummaryHighlight {
  type: 'top_category' | 'biggest_expense' | 'net_change' | 'subscriptions' | 'custom';
  data: Record<string, unknown>;
}

export interface MonthSummary {
  period: { start: string; end: string }; // ISO yyyy-mm-dd
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  changeVsPrevMonthPct: number | null;
  topCategories: Array<{
    categoryId: string;
    name: string;
    amountCents: number;
    sharePct: number;
  }>;
  biggestExpense: {
    transactionId: string;
    displayName: string;
    amountCents: number;
    date: string;
    categoryId: string | null;
    categoryName: string | null;
  } | null;
  highlights: MonthSummaryHighlight[];
}


/**
 * Get monthly summary for a given month (default: current month).
 * Excludes internal transfers, refunds, pass-through, cash withdrawals, and reimbursements by default.
 */
export async function getMonthSummary(
  db: BetterSqliteDatabase,
  month?: string, // YYYY-MM format
): Promise<MonthSummary> {
  const { start, end } = getMonthRange(month);
  
  // Exclusion clauses (matching summary.ts pattern)
  const exclusionClause = `
    AND (isRefund = 0 OR isRefund IS NULL)
    AND (isRefunded = 0 OR isRefunded IS NULL)
    AND (isInternalTransfer = 0 OR isInternalTransfer IS NULL)
    AND (isPassThrough = 0 OR isPassThrough IS NULL)
    AND (isCashWithdrawal = 0 OR isCashWithdrawal IS NULL)
    AND (isReimbursement = 0 OR isReimbursement IS NULL)
  `;

  // Get income and expenses for current month
  const currentMonthRow = db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN amountCents > 0 THEN amountCents ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN amountCents < 0 THEN amountCents ELSE 0 END), 0) AS expenses
       FROM transactions
       WHERE bookingDate BETWEEN ? AND ?
       ${exclusionClause}`,
    )
    .get(start, end) as { income: number; expenses: number };

  const incomeCents = currentMonthRow.income;
  const expenseCents = Math.abs(currentMonthRow.expenses);
  const netCents = incomeCents - expenseCents;

  // Get previous month for comparison
  const prevMonthDate = new Date(start);
  prevMonthDate.setUTCMonth(prevMonthDate.getUTCMonth() - 1);
  const prevMonthStr = `${prevMonthDate.getUTCFullYear()}-${String(prevMonthDate.getUTCMonth() + 1).padStart(2, '0')}`;
  const { start: prevStart, end: prevEnd } = getMonthRange(prevMonthStr);

  const prevMonthRow = db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN amountCents > 0 THEN amountCents ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN amountCents < 0 THEN amountCents ELSE 0 END), 0) AS expenses
       FROM transactions
       WHERE bookingDate BETWEEN ? AND ?
       ${exclusionClause}`,
    )
    .get(prevStart, prevEnd) as { income: number; expenses: number };

  const prevIncomeCents = prevMonthRow.income;
  const prevExpenseCents = Math.abs(prevMonthRow.expenses);
  const prevNetCents = prevIncomeCents - prevExpenseCents;

  // Calculate percentage change vs previous month
  let changeVsPrevMonthPct: number | null = null;
  if (prevNetCents !== 0) {
    changeVsPrevMonthPct = ((netCents - prevNetCents) / Math.abs(prevNetCents)) * 100;
  } else if (netCents !== 0) {
    // If previous month was 0 but current is not, it's a 100% change
    changeVsPrevMonthPct = netCents > 0 ? 100 : -100;
  }

  // Get top 3 spending categories (expenses only, excluding transfers)
  const categoryRows = db
    .prepare(
      `SELECT 
        COALESCE(NULLIF(TRIM(category), ''), 'other_review') AS categoryId,
        COALESCE(SUM(-amountCents), 0) AS sum
       FROM transactions
       WHERE amountCents < 0
         AND bookingDate BETWEEN ? AND ?
         ${exclusionClause}
         AND (category IS NULL OR category NOT LIKE 'transfer_%' AND category NOT LIKE 'p2p_%')
       GROUP BY categoryId
       ORDER BY sum DESC
       LIMIT 3`,
    )
    .all(start, end) as Array<{ categoryId: string; sum: number }>;

  const totalExpenseForShare = expenseCents || 1; // Avoid division by zero
  const topCategories = categoryRows.map(row => {
    const catId = (row.categoryId || 'other_review') as CategoryId;
    const def = getCategoryDefinition(catId);
    return {
      categoryId: catId,
      name: def.label,
      amountCents: row.sum,
      sharePct: (row.sum / totalExpenseForShare) * 100,
    };
  });

  // Get biggest single expense
  const biggestExpenseRow = db
    .prepare(
      `SELECT 
        id,
        bookingDate,
        amountCents,
        category,
        counterpartName,
        payee,
        purpose,
        memo
       FROM transactions
       WHERE amountCents < 0
         AND bookingDate BETWEEN ? AND ?
         ${exclusionClause}
       ORDER BY ABS(amountCents) DESC
       LIMIT 1`,
    )
    .get(start, end) as {
      id: number;
      bookingDate: string;
      amountCents: number;
      category: string | null;
      counterpartName: string | null;
      payee: string | null;
      purpose: string | null;
      memo: string | null;
    } | undefined;

  let biggestExpense: MonthSummary['biggestExpense'] = null;
  if (biggestExpenseRow) {
    const catId = (biggestExpenseRow.category || 'other_review') as CategoryId;
    const def = getCategoryDefinition(catId);
    biggestExpense = {
      transactionId: String(biggestExpenseRow.id),
      displayName: computeTransactionDisplayName({
        counterpartName: biggestExpenseRow.counterpartName,
        payee: biggestExpenseRow.payee,
        purpose: biggestExpenseRow.purpose,
        memo: biggestExpenseRow.memo,
      }),
      amountCents: Math.abs(biggestExpenseRow.amountCents),
      date: biggestExpenseRow.bookingDate,
      categoryId: catId,
      categoryName: def.label,
    };
  }

  // Generate highlights
  const highlights: MonthSummaryHighlight[] = [];

  // Highlight if a category is >30% of expenses
  for (const cat of topCategories) {
    if (cat.sharePct > 30) {
      highlights.push({
        type: 'top_category',
        data: {
          categoryId: cat.categoryId,
          categoryName: cat.name,
          sharePct: cat.sharePct,
          amountCents: cat.amountCents,
        },
      });
    }
  }

  // Highlight significant net change (>20% increase or decrease)
  if (changeVsPrevMonthPct !== null && Math.abs(changeVsPrevMonthPct) > 20) {
    highlights.push({
      type: 'net_change',
      data: {
        changePct: changeVsPrevMonthPct,
        currentNetCents: netCents,
        prevNetCents: prevNetCents,
      },
    });
  }

  // Highlight if biggest expense is unusually large (>50% of total expenses)
  if (biggestExpense && expenseCents > 0) {
    const biggestShare = (biggestExpense.amountCents / expenseCents) * 100;
    if (biggestShare > 50) {
      highlights.push({
        type: 'biggest_expense',
        data: {
          transactionId: biggestExpense.transactionId,
          displayName: biggestExpense.displayName,
          amountCents: biggestExpense.amountCents,
          sharePct: biggestShare,
        },
      });
    }
  }

  return {
    period: { start, end },
    incomeCents,
    expenseCents,
    netCents,
    changeVsPrevMonthPct,
    topCategories,
    biggestExpense,
    highlights,
  };
}

