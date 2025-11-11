import { Router } from 'express';
import type { Database } from 'better-sqlite3';
import { getLastImport } from '../db';
import { getCategoryDefinition, type CategoryId } from '../config/categories';

const dashboardRouter = Router();

const toEuros = (cents: number | null | undefined) => ((cents ?? 0) / 100);

const TODAY = () => new Date();

function isoDaysAgo(days: number) {
  const d = TODAY();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function subtractDays(iso: string, days: number) {
  const base = new Date(iso);
  if (Number.isNaN(base.getTime())) {
    return isoDaysAgo(days);
  }
  base.setDate(base.getDate() - days);
  return base.toISOString().slice(0, 10);
}

type SubscriptionInsight = {
  merchant: string;
  category: CategoryId;
  averageAmount: number;
  occurrences: number;
  intervalGuess: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'unknown';
  lastDate: string;
  nextDate?: string;
};

function daysBetween(a: string, b: string) {
  const dateA = new Date(a);
  const dateB = new Date(b);
  return Math.abs((dateB.getTime() - dateA.getTime()) / (1000 * 60 * 60 * 24));
}

function inferInterval(diff: number): SubscriptionInsight['intervalGuess'] {
  if (diff >= 6 && diff <= 9) return 'weekly';
  if (diff >= 25 && diff <= 35) return 'monthly';
  if (diff >= 80 && diff <= 100) return 'quarterly';
  if (diff >= 330 && diff <= 400) return 'yearly';
  return 'unknown';
}

function summarizeSubscriptions(rows: Array<{ merchant: string | null; category: string | null; amountCents: number; date: string }>) {
  const groups = new Map<string, { category: CategoryId; txs: { date: string; amount: number }[] }>();
  for (const row of rows) {
    const key = (row.merchant ?? '').trim();
    if (!key) continue;
    const group = groups.get(key) ?? { category: (row.category as CategoryId) ?? 'subscriptions', txs: [] };
    group.txs.push({ date: row.date, amount: Math.abs(row.amountCents) });
    groups.set(key, group);
  }

  const insights: SubscriptionInsight[] = [];

  groups.forEach((value, merchant) => {
    const txs = value.txs.sort((a, b) => a.date.localeCompare(b.date));
    if (txs.length < 2) return;

    const amounts = txs.map(t => t.amount);
    const avgAmount = amounts.reduce((acc, amt) => acc + amt, 0) / amounts.length;
    if (avgAmount === 0) return;
    const maxDeviation = Math.max(...amounts.map(a => Math.abs(a - avgAmount)));
    if (maxDeviation / avgAmount > 0.2) return; // amounts vary too much

    const diffs: number[] = [];
    for (let i = 1; i < txs.length; i += 1) {
      diffs.push(daysBetween(txs[i - 1].date, txs[i].date));
    }
    if (!diffs.length) return;
    const avgDiff = diffs.reduce((acc, diff) => acc + diff, 0) / diffs.length;
    const intervalGuess = inferInterval(avgDiff);

    const lastDate = txs[txs.length - 1].date;
    let nextDate: string | undefined;
    if (intervalGuess !== 'unknown') {
      const base = new Date(lastDate);
      if (!Number.isNaN(base.getTime())) {
        if (intervalGuess === 'weekly') base.setDate(base.getDate() + 7);
        if (intervalGuess === 'monthly') base.setMonth(base.getMonth() + 1);
        if (intervalGuess === 'quarterly') base.setMonth(base.getMonth() + 3);
        if (intervalGuess === 'yearly') base.setFullYear(base.getFullYear() + 1);
        nextDate = base.toISOString().slice(0, 10);
      }
    }

    insights.push({
      merchant,
      category: value.category,
      averageAmount: toEuros(avgAmount),
      occurrences: txs.length,
      intervalGuess,
      lastDate,
      nextDate,
    });
  });

  return insights.sort((a, b) => b.averageAmount - a.averageAmount).slice(0, 8);
}

dashboardRouter.get('/', (req, res) => {
  const db = ((req.app as any)?.locals?.db ?? null) as Database | null;
  if (!db) {
    return res.status(500).json({ error: 'database not ready' });
  }

  const lastImport = getLastImport(db);

  const balanceRow = db.prepare(`SELECT COALESCE(SUM(amountCents), 0) AS sum FROM transactions`).get() as { sum: number };

  const latestRow = db
    .prepare(`SELECT MAX(bookingDate) AS latest FROM transactions`)
    .get() as { latest: string | null };

  const referenceDate = latestRow?.latest ?? isoDaysAgo(0);
  const from30d = subtractDays(referenceDate, 30);

  const kpiRow = db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN amountCents > 0 THEN amountCents ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN amountCents < 0 THEN amountCents ELSE 0 END), 0) AS expenses
       FROM transactions
       WHERE bookingDate BETWEEN ? AND ?`,
    )
    .get(from30d, referenceDate) as { income: number; expenses: number };

  const spendingRows = db
    .prepare(
      `SELECT category AS categoryId, COALESCE(SUM(-amountCents), 0) AS sum
       FROM transactions
       WHERE amountCents < 0
       GROUP BY category`,
    )
    .all() as Array<{ categoryId: string | null; sum: number }>;

  const totalExpenses = spendingRows.reduce((acc, row) => acc + row.sum, 0);
  const spendingByCategory = spendingRows
    .map(row => {
      const catId = (row.categoryId as CategoryId) ?? 'other';
      const def = getCategoryDefinition(catId);
      const amount = toEuros(row.sum);
      const share = totalExpenses === 0 ? 0 : Number((row.sum / totalExpenses).toFixed(4));
      return {
        category: catId,
        label: def.label,
        amount,
        share,
      };
    })
    .filter(entry => entry.amount > 0.01)
    .sort((a, b) => b.amount - a.amount);
  const topCategories = spendingByCategory.slice(0, 3);

  const balanceSeriesRows = db
    .prepare(
      `SELECT bookingDate as date, SUM(amountCents) AS delta
       FROM transactions
       GROUP BY bookingDate
       ORDER BY bookingDate`,
    )
    .all() as Array<{ date: string; delta: number }>;

  let running = 0;
  const balanceOverTime = balanceSeriesRows.map(row => {
    running += row.delta;
    return { date: row.date, balance: toEuros(running) };
  });

  const cashflowRows = db
    .prepare(
      `SELECT
          strftime('%Y-%m', bookingDate) AS month,
          COALESCE(SUM(CASE WHEN amountCents > 0 THEN amountCents ELSE 0 END), 0) AS income,
          COALESCE(SUM(CASE WHEN amountCents < 0 THEN -amountCents ELSE 0 END), 0) AS expenses
        FROM transactions
        GROUP BY month
        ORDER BY month`,
    )
    .all() as Array<{ month: string; income: number; expenses: number }>;

  const cashflowByMonth = cashflowRows.map(row => ({
    month: row.month,
    income: toEuros(row.income),
    expenses: toEuros(row.expenses),
  }));

  const recentRows = db
    .prepare(
      `SELECT
         id,
         bookingDate,
         counterpartName,
         purpose,
         amountCents,
         currency,
         direction,
         counterpartyIban,
         accountIban,
         bankProfile,
         category,
         category_source AS categorySource,
         category_confidence AS categoryConfidence,
         category_explanation AS categoryExplanation,
         category_rule_id AS categoryRuleId
       FROM transactions
       ORDER BY date(bookingDate) DESC, id DESC
       LIMIT 20`,
    )
    .all() as Array<{
      id: number;
      bookingDate: string | null;
      counterpartName: string | null;
      purpose: string | null;
      amountCents: number;
      currency: string | null;
      direction: 'in' | 'out' | null;
      counterpartyIban: string | null;
      accountIban: string | null;
      bankProfile: string | null;
      category: string | null;
      categorySource: string | null;
      categoryConfidence: number | null;
      categoryExplanation: string | null;
      categoryRuleId: string | null;
    }>;

  const recentTransactions = recentRows.map(row => ({
    id: row.id,
    bookingDate: row.bookingDate ?? null,
    counterpart: row.counterpartName ?? null,
    rawText: row.purpose ?? null,
    amountCents: row.amountCents,
    amount: toEuros(row.amountCents),
    currency: row.currency ?? 'EUR',
    direction: row.direction ?? (row.amountCents >= 0 ? 'in' : 'out'),
    counterpartyIban: row.counterpartyIban ?? null,
    accountIban: row.accountIban ?? null,
    bankProfile: row.bankProfile ?? null,
    category: (row.category as CategoryId | null) ?? 'other',
    categorySource: row.categorySource,
    categoryConfidence: row.categoryConfidence,
    categoryExplanation: row.categoryExplanation,
    categoryRuleId: row.categoryRuleId,
  }));

  const totalTransactionsRow = db.prepare(`SELECT COUNT(1) AS count FROM transactions`).get() as {
    count: number;
  };

  const uncategorizedRow = db
    .prepare(
      `SELECT COUNT(1) AS count
       FROM transactions
       WHERE category IS NULL
          OR TRIM(category) = ''
         OR category = 'other_review'`,
    )
    .get() as { count: number };

  const subscriptionCandidates = db
    .prepare(
      `SELECT counterpartName AS merchant, category, amountCents, bookingDate as date
       FROM transactions
       WHERE amountCents < 0
         AND (category = 'subscriptions' OR category = 'telecom_internet' OR category = 'dining_out')
       ORDER BY counterpartName, bookingDate`,
    )
    .all() as Array<{ merchant: string | null; category: string | null; amountCents: number; date: string }>;

  const subscriptions = summarizeSubscriptions(subscriptionCandidates);

  const TAX_HINTS: Partial<Record<CategoryId, string>> = {
    fees_charges: 'Bankgebühren ggf. steuerlich absetzbar.',
    insurance: 'Versicherungsbeiträge können teilweise abgesetzt werden.',
    transport: 'Pendlerpauschale prüfen.',
      rent: 'Arbeitszimmer oder doppelte Haushaltsführung prüfen.',
    savings_investments: 'Kapitalerträge im Blick behalten.',
    taxes: 'Zahlungen für Steuern dokumentieren.',
    utilities: 'Home-Office-Pauschale berücksichtigen.',
    subscriptions: 'Berufliche Abos ggf. angeben.',
  };

  const potentialTaxRelevant = spendingByCategory
    .filter(entry => TAX_HINTS[entry.category as CategoryId])
    .slice(0, 3)
    .map(entry => ({
      category: entry.category,
      label: entry.label,
      amount: entry.amount,
      hint: TAX_HINTS[entry.category as CategoryId] ?? '',
    }));

  const net30d = toEuros(kpiRow.income + kpiRow.expenses);
  const achievementNetPositive = net30d > 0;

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

  const fees30dRow = db
    .prepare(
      `SELECT COUNT(1) AS count
       FROM transactions
       WHERE bookingDate BETWEEN ? AND ?
         AND category = 'fees_charges'`,
    )
    .get(from30d, referenceDate) as { count: number };

  const achievements = [
    {
      id: 'net_positive_30d',
      title: '30 Tage im Plus',
      description: 'Deine letzten 30 Tage enden mit einem positiven Netto.',
      achieved: achievementNetPositive,
    },
    {
      id: 'three_positive_months',
      title: 'Drei Monate Rückenwind',
      description: 'Drei aufeinanderfolgende Monate mit Überschuss.',
      achieved: threePositiveMonths,
    },
    {
      id: 'no_fees_30d',
      title: 'Ohne Bankgebühren',
      description: 'Keine Bankgebühren in den letzten 30 Tagen gezahlt.',
      achieved: fees30dRow.count === 0,
    },
  ];

  const parserWarnings = lastImport?.warnings ?? [];

  res.json({
    lastImport: lastImport
      ? {
          profileId: lastImport.profileId,
          fileName: lastImport.fileName,
          importedAt: lastImport.createdAt,
          confidence: lastImport.confidence,
          transactionCount: lastImport.transactionCount,
        }
      : undefined,
    kpis: {
      currentBalance: toEuros(balanceRow.sum),
      income30d: toEuros(kpiRow.income),
      expenses30d: Math.abs(toEuros(kpiRow.expenses)),
      net30d,
    },
    spendingByCategory,
    topCategories,
    balanceOverTime,
    cashflowByMonth,
    subscriptions,
    potentialTaxRelevant,
    achievements,
    recentTransactions,
    transactionCount: totalTransactionsRow.count ?? 0,
    uncategorizedCount: uncategorizedRow?.count ?? 0,
    parserWarnings,
  });
});

export default dashboardRouter;


