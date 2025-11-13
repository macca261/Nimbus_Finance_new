import React from 'react';

export type DashboardKpi = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  trend?: {
    label: string;
    tone: 'up' | 'down' | 'neutral';
  };
};

type DashboardKpiRowProps = {
  kpis: DashboardKpi[];
  loading?: boolean;
};

export const DashboardKpiRow: React.FC<DashboardKpiRowProps> = ({ kpis, loading }) => {
  const skeletonKPIs: DashboardKpi[] = Array.from({ length: 4 }).map((_, index) => ({
    id: `skeleton-${index}`,
    label: ' ',
    value: '—',
  }));

  const items = loading && !kpis.length ? skeletonKPIs : kpis;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((kpi, index) => (
        <article
          key={kpi.id ?? index}
          className="rounded-2xl border border-slate-200/80 bg-white px-5 py-5 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70"
        >
          <header className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {kpi.label}
            </span>
            {kpi.trend ? <TrendBadge trend={kpi.trend} /> : null}
          </header>
          <div className="mt-1 text-3xl font-semibold text-slate-900 dark:text-slate-50">
            {loading && kpi.value === '—' ? '—' : kpi.value}
          </div>
          {kpi.hint ? (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{kpi.hint}</p>
          ) : null}
        </article>
      ))}
    </div>
  );
};

function TrendBadge({ trend }: { trend: NonNullable<DashboardKpi['trend']> }) {
  const tone =
    trend.tone === 'up'
      ? 'border-emerald-300/60 text-emerald-700 dark:border-emerald-600/60 dark:text-emerald-300'
      : trend.tone === 'down'
      ? 'border-rose-300/60 text-rose-700 dark:border-rose-600/60 dark:text-rose-300'
      : 'border-slate-300/70 text-slate-600 dark:border-slate-600/60 dark:text-slate-300';

  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${tone}`}>
      {trend.label}
    </span>
  );
}

