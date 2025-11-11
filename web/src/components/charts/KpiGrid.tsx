import type { KpiSummary } from '../../lib/derive';
import { formatCurrency } from '../../lib/format';

type KpiGridProps = {
  summary: KpiSummary;
};

type KpiCardItem = {
  label: string;
  value: string;
  accent?: 'positive' | 'negative' | 'neutral';
};

function resolveAccent(value: number): 'positive' | 'negative' | 'neutral' {
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return 'neutral';
}

export function KpiGrid({ summary }: KpiGridProps) {
  const items: KpiCardItem[] = [
    {
      label: 'Aktueller Saldo',
      value: summary.currentBalance === null ? '—' : formatCurrency(summary.currentBalance),
      accent: resolveAccent(summary.currentBalance ?? 0),
    },
    {
      label: 'Einnahmen (30T)',
      value: formatCurrency(summary.income30d),
      accent: 'positive',
    },
    {
      label: 'Ausgaben (30T)',
      value: formatCurrency(-Math.abs(summary.expenses30d)),
      accent: 'negative',
    },
    {
      label: 'Netto (30T)',
      value: formatCurrency(summary.net30d),
      accent: resolveAccent(summary.net30d),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map(({ label, value, accent }) => {
        const accentClass =
          accent === 'positive'
            ? 'text-emerald-600'
            : accent === 'negative'
              ? 'text-rose-600'
              : 'text-slate-900 dark:text-slate-100';
        return (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            <p className={`mt-2 text-2xl font-semibold ${accentClass}`}>{value}</p>
          </div>
        );
      })}
    </div>
  );
}


