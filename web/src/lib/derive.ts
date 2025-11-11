import type { TransactionDto } from './financeApi';
import { getCategoryLabel } from './categories';

export interface KpiSummary {
  currentBalance: number | null;
  income30d: number;
  expenses30d: number;
  net30d: number;
}

export interface CategorySlice {
  category: string;
  total: number;
  signAwareTotal: number;
}

export interface SpendingByCategoryResult {
  slices: CategorySlice[];
  topSlices: CategorySlice[];
  otherSlice?: CategorySlice;
}

export interface BalancePoint {
  date: string;
  balance: number;
}

export interface CashflowPoint {
  month: string;
  income: number;
  expenses: number;
}

export interface SubscriptionEntry {
  name: string;
  amount: number;
  occurrences: number;
}

export interface Achievement {
  id: string;
  label: string;
  achieved: boolean;
  description?: string;
}

const SUBSCRIPTION_KEYWORDS = [
  'spotify',
  'netflix',
  'amazon prime',
  'disney',
  'icloud',
  'deezer',
  'youtube',
  'audible',
  'o2',
  'vodafone',
  'adobe',
  'apple',
  'microsoft',
];

function parseDayKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
}

function formatDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function getLatestTransactionDate(transactions: TransactionDto[]): Date | null {
  const keys = transactions
    .map(tx => tx.bookedAt?.slice(0, 10))
    .filter((key): key is string => Boolean(key));
  if (!keys.length) return null;
  const latestKey = keys.reduce((latest, key) => (key > latest ? key : latest));
  return parseDayKey(latestKey);
}

export function computeKpis(transactions: TransactionDto[]): KpiSummary {
  if (!transactions.length) {
    return { currentBalance: null, income30d: 0, expenses30d: 0, net30d: 0 };
  }

  const valid = transactions.filter(tx => tx.bookedAt);
  if (!valid.length) {
    return { currentBalance: null, income30d: 0, expenses30d: 0, net30d: 0 };
  }

  const sorted = [...valid].sort((a, b) => (a.bookedAt ?? '').localeCompare(b.bookedAt ?? ''));
  const latestDate =
    getLatestTransactionDate(sorted) ?? parseDayKey(sorted.at(-1)!.bookedAt!.slice(0, 10));
  const windowStart = addDays(latestDate, -30);
  const windowStartTime = windowStart.getTime();
  const latestTime = latestDate.getTime();

  let currentBalance = 0;
  let income30d = 0;
  let expenses30d = 0;

  for (const tx of sorted) {
    currentBalance += tx.amount;

    const txDate = parseDayKey(tx.bookedAt!.slice(0, 10));
    const timestamp = txDate.getTime();
    if (timestamp >= windowStartTime && timestamp <= latestTime) {
      if (tx.amount >= 0) income30d += tx.amount;
      else expenses30d += Math.abs(tx.amount);
    }
  }

  return {
    currentBalance,
    income30d,
    expenses30d,
    net30d: income30d - expenses30d,
  };
}

export function computeSpendingByCategory(
  transactions: TransactionDto[],
  opts: { topN?: number } = {},
): SpendingByCategoryResult {
  const topN = opts.topN ?? 6;
  if (!transactions.length) {
    return { slices: [], topSlices: [] };
  }

  const aggregates = new Map<string, { spent: number; sign: number; label: string }>();

  for (const tx of transactions) {
    if (tx.amount >= 0) continue;
    const categoryKey = (tx.category ?? 'other').trim().toLowerCase();
    const label = getCategoryLabel(categoryKey, 'de');
    const entry = aggregates.get(categoryKey) ?? { spent: 0, sign: 0, label };
    entry.label = label;
    entry.spent += Math.abs(tx.amount);
    entry.sign += tx.amount;
    aggregates.set(categoryKey, entry);
  }

  const slices: CategorySlice[] = Array.from(aggregates.entries())
    .map(([, { spent, sign, label }]) => ({
      category: label,
      total: spent,
      signAwareTotal: sign,
    }))
    .filter(slice => slice.total > 0)
    .sort((a, b) => b.total - a.total);

  const topSlices = slices.slice(0, topN);
  let otherSlice: CategorySlice | undefined;

  if (slices.length > topN) {
    const remainder = slices.slice(topN);
    const total = remainder.reduce((sum, slice) => sum + slice.total, 0);
    const signAwareTotal = remainder.reduce((sum, slice) => sum + slice.signAwareTotal, 0);
    otherSlice = {
      category: 'Andere',
      total,
      signAwareTotal,
    };
  }

  return {
    slices,
    topSlices,
    otherSlice,
  };
}

export function computeDailyBalance(transactions: TransactionDto[]): BalancePoint[] {
  if (!transactions.length) return [];

  const valid = transactions.filter(tx => tx.bookedAt);
  if (!valid.length) return [];

  const sorted = [...valid].sort((a, b) => (a.bookedAt ?? '').localeCompare(b.bookedAt ?? ''));
  const firstKey = sorted[0].bookedAt!.slice(0, 10);
  const lastKey = sorted.at(-1)!.bookedAt!.slice(0, 10);
  const start = parseDayKey(firstKey);
  const end = parseDayKey(lastKey);

  const amountsPerDay = new Map<string, number>();
  for (const tx of sorted) {
    const key = tx.bookedAt!.slice(0, 10);
    amountsPerDay.set(key, (amountsPerDay.get(key) ?? 0) + tx.amount);
  }

  const points: BalancePoint[] = [];
  let cursor = start;
  let running = 0;

  while (cursor.getTime() <= end.getTime()) {
    const key = formatDayKey(cursor);
    running += amountsPerDay.get(key) ?? 0;
    points.push({ date: key, balance: running });
    cursor = addDays(cursor, 1);
  }

  return points;
}

export function computeMonthlyCashflow(transactions: TransactionDto[]): CashflowPoint[] {
  if (!transactions.length) return [];

  const buckets = new Map<string, { income: number; expenses: number }>();

  for (const tx of transactions) {
    if (!tx.bookedAt) continue;
    const txDate = parseDayKey(tx.bookedAt.slice(0, 10));
    const key = `${txDate.getUTCFullYear()}-${`${txDate.getUTCMonth() + 1}`.padStart(2, '0')}`;
    const bucket = buckets.get(key) ?? { income: 0, expenses: 0 };
    if (tx.amount >= 0) bucket.income += tx.amount;
    else bucket.expenses += Math.abs(tx.amount);
    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries())
    .map(([month, { income, expenses }]) => ({ month, income, expenses }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

function toDisplayLabel(raw: string): string {
  return raw
    .split(' ')
    .filter(Boolean)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function computeSubscriptions(transactions: TransactionDto[]): SubscriptionEntry[] {
  if (!transactions.length) return [];

  const counters = new Map<string, { total: number; occurrences: number; label: string }>();

  for (const tx of transactions) {
    if (tx.amount >= 0) continue;
    const combined = `${tx.counterpart ?? ''} ${tx.purpose ?? ''}`.toLowerCase();
    const keyword = SUBSCRIPTION_KEYWORDS.find(k => combined.includes(k));
    const baseLabel =
      keyword ??
      tx.counterpart?.trim() ??
      tx.purpose?.trim() ??
      tx.category?.trim() ??
      'Sonstiges';
    const key = baseLabel.toLowerCase();
    const entry =
      counters.get(key) ?? { total: 0, occurrences: 0, label: toDisplayLabel(baseLabel) };
    entry.total += Math.abs(tx.amount);
    entry.occurrences += 1;
    counters.set(key, entry);
  }

  return Array.from(counters.entries())
    .filter(([, entry]) => entry.occurrences >= 2)
    .map(([, entry]) => ({
      name: entry.label,
      amount: entry.total,
      occurrences: entry.occurrences,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function computeAchievements(transactions: TransactionDto[]): Achievement[] {
  if (!transactions.length) {
    return [
      {
        id: 'import-data',
        label: 'Importiere deine erste CSV',
        achieved: false,
        description: 'Lade eine CSV-Datei hoch, um dein Dashboard zu aktivieren.',
      },
    ];
  }

  const sorted = [...transactions].sort((a, b) => a.bookedAt.localeCompare(b.bookedAt));
  const latestDate = getLatestTransactionDate(sorted) ?? parseDayKey(sorted.at(-1)!.bookedAt.slice(0, 10));
  const windowStart = addDays(latestDate, -30);
  const windowStartTime = windowStart.getTime();

  let net30 = 0;
  let largeFees = false;
  const monthlyTotals = new Map<string, number>();

  for (const tx of sorted) {
    const dateKey = tx.bookedAt.slice(0, 10);
    const txDate = parseDayKey(dateKey);
    if (txDate.getTime() >= windowStartTime) {
      net30 += tx.amount;
    }

    const monthKey = `${txDate.getUTCFullYear()}-${`${txDate.getUTCMonth() + 1}`.padStart(2, '0')}`;
    monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) ?? 0) + tx.amount);

    if (tx.amount < -10 && /gebühr|fee/i.test(`${tx.category ?? ''} ${tx.purpose ?? ''}`.toLowerCase())) {
      largeFees = true;
    }
  }

  const positiveMonths = Array.from(monthlyTotals.values()).filter(value => value > 0).length;

  return [
    {
      id: 'net-positive',
      label: '30 Tage Netto positiv',
      achieved: net30 > 0,
      description: 'Deine letzten 30 Tage enden im Plus.',
    },
    {
      id: 'steady-saver',
      label: '3 Monate im Plus',
      achieved: positiveMonths >= 3,
      description: 'Mindestens drei Monate mit positiver Bilanz.',
    },
    {
      id: 'fee-free',
      label: 'Keine hohen Gebühren',
      achieved: !largeFees,
      description: 'Keine Gebühren über 10 € gefunden.',
    },
  ];
}

// Legacy exports kept for backwards compatibility
export const getMonthlyCashflow = computeMonthlyCashflow;
export const getSubscriptions = computeSubscriptions;
export const getAchievements = computeAchievements;

