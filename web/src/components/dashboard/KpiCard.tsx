type Props = {
  label: string;
  value: string;
  hint?: string;
  loading?: boolean;
};

export default function KpiCard({ label, value, hint, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 dark:bg-zinc-900/40 dark:border-zinc-800/50 shadow-sm p-4 md:p-6">
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-20 bg-slate-200 dark:bg-zinc-700 rounded"></div>
          <div className="h-8 w-32 bg-slate-200 dark:bg-zinc-700 rounded"></div>
          {hint && <div className="h-3 w-16 bg-slate-200 dark:bg-zinc-700 rounded"></div>}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 dark:bg-zinc-900/40 dark:border-zinc-800/50 shadow-sm p-4 md:p-6">
      <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">{label}</div>
      <div className="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-slate-100 leading-tight mb-1">
        {value}
      </div>
      {hint && (
        <div className="text-xs text-slate-500 dark:text-slate-500">{hint}</div>
      )}
    </div>
  );
}

