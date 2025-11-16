import React from 'react';

type KpiCardProps = {
  label: string;
  value: string;
  hint?: string;
  isNegative?: boolean;
  loading?: boolean;
};

export const KpiCard: React.FC<KpiCardProps> = ({ label, value, hint, isNegative, loading }) => {
  const valueColor = isNegative
    ? 'text-red-600 dark:text-red-400'
    : 'text-slate-900 dark:text-slate-100';

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-6">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className={`text-2xl font-semibold tabular-nums md:text-3xl ${valueColor}`}>
        {loading ? '—' : value}
      </div>
      {hint && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      )}
    </div>
  );
};
