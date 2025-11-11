import type { PropsWithChildren } from 'react';

type BadgeProps = PropsWithChildren<{
  intent?: 'neutral' | 'accent' | 'success' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}>;

const intentStyles: Record<NonNullable<BadgeProps['intent']>, string> = {
  neutral: 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
  accent: 'bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-200 dark:border-indigo-500/40',
  success: 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-500/40',
  danger: 'bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-500/40',
};

const sizeStyles: Record<NonNullable<BadgeProps['size']>, string> = {
  sm: 'text-[10px] px-2 py-0.5 rounded-full',
  md: 'text-xs px-2.5 py-0.5 rounded-full',
  lg: 'text-xs px-3 py-1 rounded-full font-medium',
};

export function Badge({ intent = 'neutral', size = 'md', className, children }: BadgeProps) {
  const base = `${intentStyles[intent]} ${sizeStyles[size]} inline-flex items-center gap-1 select-none`;
  return <span className={className ? `${base} ${className}` : base}>{children}</span>;
}


