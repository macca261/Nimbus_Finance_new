import { ReactNode } from 'react';

type KpiCardProps = {
  title: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: 'default' | 'success' | 'info';
};

const toneStyles: Record<NonNullable<KpiCardProps['tone']>, string> = {
  default: 'bg-[var(--surface-muted)] text-slate-600',
  success: 'bg-[var(--surface-success)] text-emerald-600',
  info: 'bg-[var(--surface-info)] text-sky-600',
};

export default function KpiCard({ title, value, hint, icon, tone = 'default' }: KpiCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 flex items-start justify-between gap-4">
      <div className="space-y-1 flex-1">
        <p className="text-sm text-zinc-500">{title}</p>
        <p className="text-2xl font-semibold text-slate-900 tabular-nums">{value}</p>
        {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
      </div>
      {icon ? (
        <div className={`rounded-full ${toneStyles[tone]} p-2 flex items-center justify-center flex-shrink-0`}>{icon}</div>
      ) : null}
    </div>
  );
}

