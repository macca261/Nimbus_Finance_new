import React from 'react';
import { AppShell } from '../layout/AppShell';

type ComingSoonProps = {
  title: string;
  description?: string;
};

export const ComingSoon: React.FC<ComingSoonProps> = ({ title, description }) => (
  <AppShell>
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-8 text-center shadow-soft transition-colors dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{title}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {description ?? 'Demnächst verfügbar.'}
        </p>
      </div>
      <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Wir arbeiten daran 🚧</h2>
        <p className="mt-2">
          Dieses Modul befindet sich gerade im Bau. Bald gibt’s hier eine vollwertige Premium-Erfahrung.
        </p>
      </div>
    </div>
  </AppShell>
);

