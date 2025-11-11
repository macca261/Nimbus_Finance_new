import type { PropsWithChildren } from 'react';

type CardProps = PropsWithChildren<{
  className?: string;
}>;

export default function Card({ children, className }: CardProps) {
  const base =
    'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition dark:border-slate-800 dark:bg-slate-900';
  const merged = className ? `${base} ${className}` : base;
  return <div className={merged}>{children}</div>;
}
