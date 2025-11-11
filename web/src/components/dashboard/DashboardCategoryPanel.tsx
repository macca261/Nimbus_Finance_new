import React from 'react';
import { CategoryDonut, type CategorySlice } from './CategoryDonut';
import { formatCurrency, formatPercent } from '../../lib/format';
import { getCategoryMeta } from '../../lib/categories';

type DashboardCategoryPanelProps = {
  data: CategorySlice[];
  loading?: boolean;
};

export const DashboardCategoryPanel: React.FC<DashboardCategoryPanelProps> = ({ data, loading }) => {
  const total = data.reduce((sum, slice) => sum + slice.total, 0);
  const topFive = data
    .filter(slice => slice.total > 0)
    .slice(0, 5)
    .map(slice => ({
      ...slice,
      share: total > 0 ? slice.total / total : 0,
    }));

  return (
    <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white/80 shadow-sm shadow-slate-500/10 dark:border-slate-800 dark:bg-slate-900/70">
      <header className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Top Kategorien</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Ausgabenanteile nach Kategorie</p>
      </header>
      <div className="grid flex-1 gap-4 px-6 py-4 sm:grid-cols-[1.2fr_1fr]">
        <div className="flex items-center justify-center">
          <CategoryDonut data={data} loading={loading} />
        </div>
        <ul className="flex flex-col gap-3">
          {topFive.map(slice => {
            const meta = getCategoryMeta(slice.id);
            return (
              <li
                key={slice.id}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900/60"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: `${meta.color}33`, color: meta.color }}>
                    {meta.icon ?? '•'}
                  </span>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{slice.label || meta.label || slice.id}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{formatCurrency(slice.total)}</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {formatPercent(slice.share)}
                </span>
              </li>
            );
          })}
          {!topFive.length && !loading ? (
            <li className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
              Noch keine Ausgaben erfasst.
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
};


