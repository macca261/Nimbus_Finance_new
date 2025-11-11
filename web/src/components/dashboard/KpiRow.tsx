import { ArrowDownRight, ArrowUpRight, Wallet, Wallet2 } from 'lucide-react';
import React from 'react';
import type { Kpis } from '../../state/useFinanceStore';
import { formatCurrency, formatPercent } from '../../lib/format';

type KpiRowProps = {
  kpis: Kpis;
  loading?: boolean;
};

export const KpiRow: React.FC<KpiRowProps> = ({ kpis, loading }) => {
  const cards = [
    {
      label: 'Aktueller Kontostand',
      value: formatCurrency(kpis.balance),
      hint: 'inkl. aller importierten Buchungen',
      icon: Wallet,
      accent: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200',
    },
    {
      label: 'Einnahmen (30 Tage)',
      value: formatCurrency(kpis.income30d),
      icon: ArrowUpRight,
      accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
    },
    {
      label: 'Ausgaben (30 Tage)',
      value: formatCurrency(kpis.expenses30d),
      icon: ArrowDownRight,
      accent: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
    },
    {
      label: 'Sparquote',
      value: formatPercent(kpis.savingsRate),
      hint: kpis.income30d > 0 ? 'Anteil der letzten 30 Tage' : undefined,
      icon: Wallet2,
      accent: 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-200',
    },
  ];

  const isLoading = Boolean(loading);

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(card => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-soft transition-colors dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{card.label}</p>
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${card.accent} transition-colors`}
                aria-hidden="true"
              >
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {isLoading ? <SkeletonBar /> : card.value}
            </p>
            {card.hint ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{isLoading ? '—' : card.hint}</p>
            ) : null}
          </div>
        );
      })}
    </section>
  );
};

const SkeletonBar = () => (
  <span className="inline-block h-6 w-20 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
);
