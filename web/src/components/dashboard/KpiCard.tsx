import React from 'react';
import { Wallet, ArrowUpCircle, ArrowDownCircle, Target } from 'lucide-react';

type KpiCardProps = {
  label: string;
  value: string;
  hint?: string;
  isNegative?: boolean;
  loading?: boolean;
  icon?: 'wallet' | 'income' | 'expense' | 'target';
};

const iconMap = {
  wallet: Wallet,
  income: ArrowUpCircle,
  expense: ArrowDownCircle,
  target: Target,
};

export const KpiCard: React.FC<KpiCardProps> = ({ label, value, hint, isNegative, loading, icon = 'wallet' }) => {
  const valueColor = isNegative
    ? 'text-rose-600 dark:text-rose-400'
    : 'text-slate-900 dark:text-slate-50';
  
  const IconComponent = iconMap[icon];
  const iconColor = isNegative
    ? 'text-rose-500 dark:text-rose-400'
    : icon === 'income'
    ? 'text-emerald-500 dark:text-emerald-400'
    : icon === 'target'
    ? 'text-indigo-500 dark:text-indigo-400'
    : 'text-slate-400 dark:text-slate-500';

  const iconBgColor = isNegative
    ? 'bg-nf-negative/10 text-nf-negative'
    : icon === 'income'
    ? 'bg-nf-positive/10 text-nf-positive'
    : icon === 'target'
    ? 'bg-nf-primary-soft text-nf-primary'
    : 'bg-nf-bg-card-subtle text-nf-text-muted';

  return (
    <div className="group relative rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-5 sm:p-6 lg:p-7 shadow-elevated transition-all duration-200 ease-out hover:-translate-y-[1px] hover:shadow-xl">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${iconBgColor}`}>
            <IconComponent className="h-4 w-4" />
          </div>
          <div className="text-[11px] font-semibold text-nf-text-muted uppercase tracking-wide">
            {label}
          </div>
        </div>
      </div>
      <div className={`text-2xl sm:text-3xl font-semibold tabular-nums leading-tight mb-1 ${
        isNegative ? 'text-nf-negative' : 'text-nf-text-main'
      }`}>
        {loading ? '—' : value}
      </div>
      {hint && (
        <p className="text-[11px] text-nf-text-muted mt-2 line-clamp-1">
          {hint}
        </p>
      )}
    </div>
  );
};
