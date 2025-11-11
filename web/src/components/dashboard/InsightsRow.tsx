import React from 'react';
import { formatCurrency } from '../../lib/format';
import type { DashboardSubscription, TaxHint } from '../../hooks/useDashboardData';

type InsightsRowProps = {
  subscriptions: DashboardSubscription[];
  taxHints: TaxHint[];
  cashflowByMonth: Array<{ month: string; income: number; expenses: number }>;
  uncategorizedCount?: number;
};

function computeMonthInsight(cashflowByMonth: InsightsRowProps['cashflowByMonth']) {
  if (!cashflowByMonth.length) {
    return { title: 'No data yet', detail: 'Import Buchungen, um Trends zu sehen.' };
  }
  const sorted = [...cashflowByMonth].sort((a, b) => a.month.localeCompare(b.month));
  const latest = sorted.at(-1)!;
  const prev = sorted.length > 1 ? sorted.at(-2)! : undefined;
  const netLatest = latest.income - latest.expenses;
  const netPrev = prev ? prev.income - prev.expenses : 0;
  const diff = netLatest - netPrev;
  return {
    title: netLatest >= 0 ? 'Netto im Plus' : 'Netto im Minus',
    detail: prev
      ? `Differenz zu ${prev.month}: ${formatCurrency(diff)}`
      : `Nettobilanz: ${formatCurrency(netLatest)}`,
  };
}

export const InsightsRow: React.FC<InsightsRowProps> = ({
  subscriptions,
  taxHints,
  cashflowByMonth,
  uncategorizedCount = 0,
}) => {
  const subscription = subscriptions[0];
  const taxHint = taxHints[0];
  const monthInsight = computeMonthInsight(cashflowByMonth);

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Subscriptions</p>
        {subscription ? (
          <>
            <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{subscription.merchant}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {subscription.intervalGuess !== 'unknown' ? `${translateInterval(subscription.intervalGuess)} · ` : ''}
              {formatCurrency(subscription.averageAmount)} pro Zyklus
            </p>
            {subscription.nextDate ? (
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Nächste Fälligkeit: {subscription.nextDate}
              </p>
            ) : null}
            {uncategorizedCount > 0 ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {uncategorizedCount} Buchung{uncategorizedCount === 1 ? '' : 'en'} ohne Kategorie – prüfen!
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Noch keine wiederkehrenden Abos erkannt.</p>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Tax hints</p>
        {taxHint ? (
          <>
            <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{taxHint.label}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {formatCurrency(taxHint.amount)} · {taxHint.hint}
            </p>
          </>
        ) : (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Keine steuerrelevanten Hinweise aktuell.</p>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">This month vs last month</p>
        <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{monthInsight.title}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{monthInsight.detail}</p>
      </div>
    </section>
  );
};

function translateInterval(interval: DashboardSubscription['intervalGuess']) {
  switch (interval) {
    case 'weekly':
      return 'wöchentlich';
    case 'monthly':
      return 'monatlich';
    case 'quarterly':
      return 'quartalsweise';
    case 'yearly':
      return 'jährlich';
    default:
      return 'regelmäßig';
  }
}


