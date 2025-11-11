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
  if (loading && !kpis.length) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-28 rounded-3xl border border-slate-200 bg-slate-100/60 animate-pulse dark:border-slate-800 dark:bg-slate-900/50"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map(kpi => (
        <article
          key={kpi.id}
          className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white/80 px-5 py-4 shadow-sm shadow-slate-500/10 transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900/70"
        >
          <header className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {kpi.label}
            </span>
            {kpi.trend ? <TrendBadge trend={kpi.trend} /> : null}
          </header>
          <div className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{kpi.value}</div>
          {kpi.hint ? <p className="text-xs text-slate-500 dark:text-slate-400">{kpi.hint}</p> : null}
        </article>
      ))}
    </div>
  );
};

function TrendBadge({ trend }: { trend: NonNullable<DashboardKpi['trend']> }) {
  const tone =
    trend.tone === 'up'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
      : trend.tone === 'down'
      ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200'
      : 'bg-slate-100 text-slate-500 dark:bg-slate-800/80 dark:text-slate-300';

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${tone}`}>
      {trend.label}
    </span>
  );
}


