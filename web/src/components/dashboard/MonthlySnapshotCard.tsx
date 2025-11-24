import React from 'react';
import { formatCurrency } from '../../lib/format';
import type { MonthlyInsights } from '../../lib/hooks/useMonthlyInsights';

type MonthlySnapshotCardProps = {
  insights: MonthlyInsights;
  noCard?: boolean;
};

export const MonthlySnapshotCard: React.FC<MonthlySnapshotCardProps> = ({ insights, noCard }) => {
  const { topCategory, biggestExpense, transactionCount, isLoading, error } = insights;

  const content = (
    <>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-base font-semibold text-nf-text-main mb-1">Dein Monat</h3>
        <p className="text-[11px] text-nf-text-muted">Letzte 30 Tage</p>
      </div>

      {error ? (
        <div className="py-8 text-center text-sm text-nf-text-muted">
          {error}
        </div>
      ) : isLoading ? (
        <div className="py-8 text-center text-sm text-nf-text-muted">
          Lade Daten…
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stat Section 1: Top-Kategorie */}
          <div className="flex items-baseline justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-nf-text-muted mb-1">
                Top-Kategorie
              </p>
              <p className="text-sm sm:text-base font-semibold text-nf-text-main break-words" title={topCategory?.labelDe}>
                {topCategory?.labelDe || '—'}
              </p>
            </div>
            {topCategory && (
              <p className="text-sm font-medium text-nf-text-muted tabular-nums whitespace-nowrap">
                {formatCurrency(topCategory.amountCents / 100)}
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-nf-border-subtle/60" />

          {/* Stat Section 2: Größte Ausgabe */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-nf-text-muted mb-1">
                Größte Ausgabe
              </p>
              {biggestExpense ? (
                <>
                  <p className="text-sm sm:text-base font-semibold text-nf-negative tabular-nums mb-0.5">
                    {formatCurrency(biggestExpense.amountCents / 100)}
                  </p>
                  <p className="text-xs text-nf-text-muted line-clamp-2" title={biggestExpense.label}>
                    {biggestExpense.label}
                  </p>
                </>
              ) : (
                <p className="text-sm sm:text-base font-semibold text-nf-text-main">—</p>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-nf-border-subtle/60" />

          {/* Stat Section 3: Buchungen */}
          <div className="flex items-baseline justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-nf-text-muted mb-1">
                Buchungen
              </p>
              <p className="text-sm sm:text-base font-semibold text-nf-text-main tabular-nums">
                {transactionCount ?? 0}
              </p>
            </div>
            <p className="text-xs text-nf-text-muted whitespace-nowrap">
              im ausgewählten Zeitraum
            </p>
          </div>
        </div>
      )}
    </>
  );

  if (noCard) {
    return content;
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 p-5 lg:p-6 shadow-sm">
      {content}
    </div>
  );
};
