type Props = { title: string; value: string; sub?: string; trend?: number };

export default function KpiCard({ title, value, sub, trend }: Props) {
  const up = (trend ?? 0) >= 0;
  return (
    <div className="p-4">
      <div className="text-sm text-slate-500 dark:text-slate-400">{title}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
        {trend !== undefined && (
          <span
            className={`px-1.5 py-0.5 rounded-md ${
              up
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
                : 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200'
            }`}
          >
            {up ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

