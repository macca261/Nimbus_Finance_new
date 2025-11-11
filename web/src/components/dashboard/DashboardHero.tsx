import React from 'react';
import { AlertTriangle, ArrowUpRight, CalendarClock, UploadCloud } from 'lucide-react';
import type { DashboardSummary } from '../../hooks/useDashboardData';
import { formatCurrency, formatDate } from '../../lib/format';
import { UploadCSV } from '../UploadCSV';
import { ResetDataButton } from '../ResetDataButton';

type DashboardHeroProps = {
  summary?: DashboardSummary | null;
  onImported?: () => void;
  onReset?: () => void;
};

export const DashboardHero: React.FC<DashboardHeroProps> = ({ summary, onImported, onReset }) => {
  const displayName = 'Nimbus Nutzer';
  const lastImport = summary?.lastImport;
  const warnings = summary?.parserWarnings ?? [];
  const net30d = summary?.kpis.net30d ?? 0;
  const infoTone =
    warnings.length > 0
      ? 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-400/40'
      : 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-400/40';

  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-2xl shadow-indigo-500/10 backdrop-blur-md transition-colors dark:border-slate-800 dark:bg-slate-950/70 sm:p-8">
      <div className="pointer-events-none absolute inset-y-[-40%] right-[-15%] w-2/3 rounded-full bg-gradient-to-br from-indigo-500/30 via-sky-400/20 to-transparent blur-3xl dark:from-indigo-500/30 dark:via-sky-500/20" />
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-200">
              Willkommen zurück
            </span>
            <h1 className="mt-4 text-3xl font-semibold text-slate-900 dark:text-slate-50">
              Welcome back, {displayName}! 👋
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-400">
              Lade einen Kontoauszug hoch und erhalte sofort smarte Insights über deine Finanzen.
            </p>
          </div>

          <div className={`inline-flex w-fit items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium ${infoTone}`}>
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            <span>
              {lastImport
                ? `${lastImport.profileId} • ${formatDate(lastImport.importedAt)} • ${
                    lastImport.transactionCount ?? 0
                  } Buchungen${warnings.length ? ` • ${warnings.length} Hinweis${warnings.length > 1 ? 'e' : ''}` : ''}`
                : 'Noch kein Import vorhanden'}
            </span>
          </div>

          <div className="grid gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
            <HeroMetric
              icon={<ArrowUpRight className="h-5 w-5 text-indigo-500" />}
              label="Saldo der letzten 30 Tage"
              value={formatCurrency(net30d)}
            />
            <HeroMetric
              icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
              label="Parser Hinweise"
              value={warnings.length ? `${warnings.length} offen` : 'Keine Hinweise'}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-3xl border border-white/40 bg-white/70 p-5 shadow-xl shadow-indigo-500/10 dark:border-slate-800/60 dark:bg-slate-900/80">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">CSV Upload</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Unterstützt: comdirect, Sparkasse & weitere deutsche Banken
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-3 py-1 text-[11px] font-medium text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200">
              <UploadCloud className="h-3.5 w-3.5" />
              Drag & Drop
            </span>
          </div>
          <div className="rounded-2xl border border-dashed border-slate-300/70 bg-slate-100/60 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
            <p className="font-medium text-slate-700 dark:text-slate-200">CSV hochladen (Drag & Drop oder Klick)</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Wir kümmern uns um Parsing, Normalisierung und Kategorisierung in Sekunden.
            </p>
          </div>
          <UploadCSV onImported={onImported} />
          {import.meta.env.DEV ? <ResetDataButton onReset={onReset} /> : null}
          <UploadDetails lastImport={lastImport} warnings={warnings} />
        </div>
      </div>
    </section>
  );
};

type HeroMetricProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
};

const HeroMetric: React.FC<HeroMetricProps> = ({ icon, label, value }) => (
  <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 shadow-sm shadow-slate-500/5 dark:border-slate-800 dark:bg-slate-900/70">
    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20 dark:text-indigo-200">
      {icon}
    </span>
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
      <p className="font-semibold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  </div>
);

type UploadDetailsProps = {
  lastImport?: DashboardSummary['lastImport'];
  warnings: string[];
};

const UploadDetails: React.FC<UploadDetailsProps> = ({ lastImport, warnings }) => (
  <div className="space-y-3 rounded-2xl border border-slate-200/60 bg-slate-50/80 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
    <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Letzter Upload</p>
    {lastImport ? (
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:text-sm">
        <div>
          <dt className="text-slate-400 dark:text-slate-500">Profil</dt>
          <dd className="font-medium text-slate-700 dark:text-slate-200">{lastImport.profileId}</dd>
        </div>
        <div>
          <dt className="text-slate-400 dark:text-slate-500">Datei</dt>
          <dd className="font-medium text-slate-700 dark:text-slate-200">{lastImport.fileName}</dd>
        </div>
        <div>
          <dt className="text-slate-400 dark:text-slate-500">Buchungen</dt>
          <dd className="font-medium text-slate-700 dark:text-slate-200">{lastImport.transactionCount}</dd>
        </div>
        <div>
          <dt className="text-slate-400 dark:text-slate-500">Confidence</dt>
          <dd className="font-medium text-slate-700 dark:text-slate-200">{Math.round((lastImport.confidence ?? 0) * 100)}%</dd>
        </div>
      </dl>
    ) : (
      <p className="text-xs text-slate-500">Noch kein Upload erfolgt.</p>
    )}
    {warnings.length ? (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
        <div className="flex items-center gap-2 font-medium">
          <AlertTriangle className="h-4 w-4" />
          {warnings.length} Parser Hinweis{warnings.length > 1 ? 'e' : ''}
        </div>
        <ul className="mt-1 space-y-1">
          {warnings.slice(0, 3).map((warning, index) => (
            <li key={index} className="leading-snug">
              {warning}
            </li>
          ))}
          {warnings.length > 3 ? <li>…</li> : null}
        </ul>
      </div>
    ) : null}
  </div>
);


