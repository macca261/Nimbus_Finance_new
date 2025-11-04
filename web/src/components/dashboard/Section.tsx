import { ReactNode } from 'react';

type Props = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  loading?: boolean;
  error?: string;
  className?: string;
};

export default function Section({ title, subtitle, right, children, loading, error, className = '' }: Props) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 dark:bg-zinc-900/40 dark:border-zinc-800/50 shadow-sm p-5 md:p-6 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-slate-100 leading-tight">
            {title}
          </h3>
          {subtitle && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{subtitle}</p>
          )}
        </div>
        {right && <div>{right}</div>}
      </div>
      {error ? (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          <p>{error}</p>
        </div>
      ) : loading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-32 bg-slate-200 dark:bg-zinc-700 rounded"></div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

