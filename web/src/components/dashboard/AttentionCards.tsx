import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatPercent } from '../../lib/format';
import { getCategoryMeta } from '../../lib/categories';

type AttentionCardsProps = {
  reviewCounts: {
    uncategorized: number;
    lowConfidence: number;
  };
  reviewLoading: boolean;
  spendingByCategory: Array<{
    category: string;
    label?: string;
    amount: number;
  }>;
  dateRangeLabel: string;
  onNavigateToTransactions: (params: Record<string, string>) => void;
};

export const AttentionCards: React.FC<AttentionCardsProps> = ({
  reviewCounts,
  reviewLoading,
  spendingByCategory,
  dateRangeLabel,
  onNavigateToTransactions,
}) => {
  // Calculate Sonstiges share
  const totalExpenses = spendingByCategory.reduce((sum, cat) => sum + cat.amount, 0);
  const otherCategory = spendingByCategory.find(cat => cat.category === 'other' || cat.category === 'other_review');
  const otherAmount = otherCategory?.amount ?? 0;
  const otherShare = totalExpenses > 0 ? otherAmount / totalExpenses : 0;
  const otherCount = otherCategory ? (otherCategory as any).count : undefined;

  const showSonstigesCard = otherShare > 0.05 || otherAmount > 0;

  return (
    <div className="grid gap-6 md:grid-cols-12">
      {/* Zu prüfen */}
      <div className="md:col-span-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-6">
          <h3 className="mb-4 text-base font-medium text-slate-900 dark:text-slate-100 md:text-lg">
            Zu prüfen
          </h3>
          <div className="space-y-3">
            <button
              onClick={() => onNavigateToTransactions({ category: 'other' })}
              className="inline-flex w-full items-center justify-between gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200"
            >
              <span>Unkategorisiert</span>
              <span className="tabular-nums font-semibold">
                {reviewLoading ? '—' : reviewCounts.uncategorized.toLocaleString('de-DE')}
              </span>
            </button>
            <button
              onClick={() => onNavigateToTransactions({})}
              className="inline-flex w-full items-center justify-between gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-700 transition hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
            >
              <span>Niedrige Confidence</span>
              <span className="tabular-nums font-semibold">
                {reviewLoading ? '—' : reviewCounts.lowConfidence.toLocaleString('de-DE')}
              </span>
            </button>
          </div>
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Bearbeite diese Buchungen, um deine Auswertungen zu verbessern.
          </p>
        </div>
      </div>

      {/* Sonstiges aufräumen */}
      {showSonstigesCard && (
        <div className="md:col-span-4">
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10 md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-medium text-amber-900 dark:text-amber-200 md:text-lg">
                Sonstiges aufräumen
              </h3>
              <span className="inline-flex items-center rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                Empfohlen
              </span>
            </div>
            <div className="mb-4">
              <p className="text-lg font-semibold tabular-nums text-amber-900 dark:text-amber-200">
                Sonstiges: {formatCurrency(otherAmount)} ({formatPercent(otherShare)} deiner Ausgaben)
              </p>
              {otherCount !== undefined && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  {otherCount.toLocaleString('de-DE')} Buchungen
                </p>
              )}
            </div>
            <p className="mb-4 text-xs text-amber-700 dark:text-amber-300">
              Viele dieser Buchungen könnten eine genauere Kategorie bekommen.
            </p>
            <button
              onClick={() => onNavigateToTransactions({ category: 'other' })}
              className="w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:bg-amber-500 dark:hover:bg-amber-600"
            >
              Sonstiges bereinigen
            </button>
          </div>
        </div>
      )}

      {/* Placeholder for third card or spacing */}
      <div className="md:col-span-4" />
    </div>
  );
};

