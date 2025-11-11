import { UploadCloud, Moon, Sun } from 'lucide-react';
import { useDarkMode } from '../../hooks/useDarkMode';
import type { DerivedDashboard } from '../../lib/derive';

type HeaderProps = {
  profileId?: string;
  confidence?: number;
  totals: DerivedDashboard['totals'];
};

export default function Header({ profileId, confidence, totals }: HeaderProps) {
  const { dark, toggle } = useDarkMode();

  const subtitle = totals.transactionCount > 0 && profileId
    ? `Letzter Import: ${profileId} · ${totals.transactionCount} Buchungen · ${confidence != null ? Math.round(confidence * 100) : '—'}% confidence`
    : 'Lade eine CSV hoch, um dein Dashboard zu befüllen.';

  return (
    <header className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Nimbus Finance – Dashboard</h1>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm">{subtitle}</p>
        {totals.transactionCount > 0 && totals.dateRange && (
          <p className="text-xs text-neutral-500 dark:text-neutral-500">
            Zeitraum: {totals.dateRange.from} → {totals.dateRange.to}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium transition hover:border-nimbus-primary hover:text-nimbus-primary dark:border-neutral-700 dark:hover:border-nimbus-primary"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <UploadCloud size={16} /> CSV hochladen
        </button>
        <button
          aria-label="Theme umschalten"
          onClick={toggle}
          className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-3 py-2 text-sm transition hover:border-nimbus-primary dark:border-neutral-700 dark:hover:border-nimbus-primary"
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />} {dark ? 'Hell' : 'Dunkel'}
        </button>
      </div>
    </header>
  );
}

