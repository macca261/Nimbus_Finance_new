import { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white shadow-sm ring-1 ring-black/5 ${className}`}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`p-4 md:p-6 ${className}`}>{children}</div>;
}

export function Stat({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div>
        <div className="text-sm text-slate-500">{label}</div>
        <div className="text-2xl font-semibold text-slate-900">{value}</div>
      </div>
    </div>
  );
}

