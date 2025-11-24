import React from 'react';
import { formatCurrency } from '../../lib/format';
import { MiniCashflowSparkline } from '../dashboard/MiniCashflowSparkline';
import type { DashboardSummary } from '../../hooks/useDashboardData';

export interface DashboardHeroProps {
  userName?: string | null;
  primaryAccountLabel?: string | null;
  income30d?: number;
  expenses30d?: number;
  balanceOverTime?: DashboardSummary['balanceOverTime'];
  loading?: boolean;
}

const HERO_SHELL_CLASS = 'mx-auto w-full max-w-[1920px] px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12';

export const DashboardHero: React.FC<DashboardHeroProps> = ({ 
  userName, 
  primaryAccountLabel,
  income30d = 0,
  expenses30d = 0,
  balanceOverTime = [],
  loading = false,
}) => {
  const name = userName ?? 'Aaron';

  return (
    <section
      className="relative isolate w-full overflow-hidden bg-[radial-gradient(circle_at_top,_#e0f2fe_0,_#bfdbfe_35%,_#f1f5f9_100%)] dark:bg-[radial-gradient(circle_at_top,_#0ea5e9_0,_#020617_55%,_#000000_100%)]"
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.15] mix-blend-soft-light" />

      {/* Content container - matches dashboard shell */}
      <div className={`${HERO_SHELL_CLASS} relative py-6 lg:py-6`}>
        <div className="grid gap-6 lg:gap-8 lg:grid-cols-[minmax(0,2.6fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,2.8fr)_minmax(0,1fr)] items-start">
          {/* Left column – greeting + actions */}
          <div className="flex flex-col gap-3 w-full lg:max-w-none">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-sky-100/80 dark:text-sky-200/80">
              Dashboard · Heute
            </p>
            <h1 className="text-[1.9rem] md:text-[2.1rem] lg:text-[2.4rem] xl:text-[2.5rem] font-semibold tracking-tight leading-tight text-slate-900 dark:text-slate-50">
              Guten Abend, {name} 👋
            </h1>
            <p className="text-sm md:text-base leading-relaxed text-slate-700/90 dark:text-slate-200/80 max-w-2xl lg:max-w-none">
              Nimbus bündelt deine Konten, Verträge und Erstattungen in einem Blick – ohne Tabellenchaos.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3 md:gap-4">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full bg-nf-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-nf-primary hover:shadow-glow-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nf-primary focus-visible:ring-offset-2 transition-all duration-200"
              >
                <span className="text-lg leading-none">+</span>
                Konto verbinden
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 dark:bg-slate-900/60 dark:text-slate-100 transition"
                onClick={() => {
                  window.location.href = '/imports';
                }}
              >
                CSV hochladen
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/40 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100 transition"
              >
                Demo-Daten ansehen
              </button>
            </div>

            <div className="mt-2 flex items-center gap-2 text-xs text-slate-600/90 dark:text-slate-300/80 max-w-md">
              <span className="relative flex h-2 w-2 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span>Deine Daten bleiben verschlüsselt und auf EU-Servern.</span>
            </div>

            {/* Above-the-fold money snapshot: quick last-30-days summary to avoid empty hero space */}
            {(income30d > 0 || expenses30d > 0 || balanceOverTime.length > 0) && (
              <div className="mt-4 lg:mt-5 rounded-2xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm p-3 shadow-elevated dark:shadow-elevated">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  {/* Left: Text summary */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-nf-text-muted mb-1.5">Letzte 30 Tage</p>
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                      <span className="tabular-nums">
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          {formatCurrency(income30d)}
                        </span>
                        <span className="text-nf-text-muted ml-1">Einnahmen</span>
                      </span>
                      <span className="tabular-nums">
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">
                          {formatCurrency(expenses30d)}
                        </span>
                        <span className="text-nf-text-muted ml-1">Ausgaben</span>
                      </span>
                    </div>
                  </div>
                  {/* Right: Mini sparkline */}
                  <div className="flex-shrink-0 lg:w-48">
                    <MiniCashflowSparkline balance={balanceOverTime} loading={loading} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right column – snapshot tiles */}
          <div className="flex justify-start lg:justify-end">
            <div className="w-full max-w-sm space-y-4">
              {/* Main balance card */}
              <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm p-4 shadow-elevated dark:shadow-elevated transition-all duration-200 ease-out hover:-translate-y-[1px] hover:shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Nimbus Balance
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {primaryAccountLabel ?? 'Alle Konten'}
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-50">
                      3.250,40&nbsp;€
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300">
                    +220,00 € diesen Monat
                  </span>
                </div>
              </div>

              {/* Bottom row: two smaller cards */}
              <div className="grid grid-cols-2 gap-4">
                {/* Money health */}
                <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm p-4 shadow-elevated dark:shadow-elevated transition-all duration-200 ease-out hover:-translate-y-[1px] hover:shadow-2xl">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 mb-2">
                    Money Health
                  </p>
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative flex h-12 w-12 items-center justify-center">
                      <div className="absolute inset-0 rounded-full border border-slate-300 dark:border-slate-600/80" />
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">82%</span>
                    </div>
                    <p className="text-[10px] text-center text-slate-600/80 dark:text-slate-300/80">
                      Basierend auf deinen letzten 90 Tagen.
                    </p>
                  </div>
                </div>

                {/* This month */}
                <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm p-4 shadow-elevated dark:shadow-elevated transition-all duration-200 ease-out hover:-translate-y-[1px] hover:shadow-2xl">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 mb-2">
                    Diesen Monat
                  </p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-600/80 dark:text-slate-300/80">Einnahmen</span>
                      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-300">+1.950 €</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-600/80 dark:text-slate-300/80">Ausgaben</span>
                      <span className="text-[11px] font-medium text-rose-600 dark:text-rose-300">-1.280 €</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Today tasks - full width below */}
              <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm p-4 shadow-elevated dark:shadow-elevated transition-all duration-200 ease-out hover:-translate-y-[1px] hover:shadow-2xl">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 mb-2">
                  Heute erledigen
                </p>
                <ul className="space-y-1.5 text-[11px] text-slate-600/80 dark:text-slate-300/80">
                  <li>• 2 Erstattungen prüfen</li>
                  <li>• 1 Vertrag verlängert sich bald</li>
                  <li>• Konto bei XYZ verbinden</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
