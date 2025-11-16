import React from 'react';
import { Filter, UploadCloud, AlertTriangle } from 'lucide-react';
import type { AccountOption, PeriodOption } from '../../hooks/useDashboardState';

type DashboardHeaderCompactProps = {
  userName?: string | null;
  accounts: AccountOption[];
  selectedAccount: string;
  onSelectAccount: (id: string) => void;
  periodOptions: PeriodOption[];
  selectedPeriod: PeriodOption;
  onSelectPeriod: (id: PeriodOption['id']) => void;
  hasWarnings: boolean;
  warningsCount: number;
  onWarningsClick?: () => void;
  onUploadClick?: () => void;
  lastImportInfo?: string | null;
};

const USER_NAME = 'Aaron';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return `Guten Morgen, ${USER_NAME}`;
  if (hour < 18) return `Willkommen zurück, ${USER_NAME}`;
  return `Guten Abend, ${USER_NAME}`;
}

export const DashboardHeaderCompact: React.FC<DashboardHeaderCompactProps> = ({
  userName,
  accounts,
  selectedAccount,
  onSelectAccount,
  periodOptions,
  selectedPeriod,
  onSelectPeriod,
  hasWarnings,
  warningsCount,
  onWarningsClick,
  onUploadClick,
  lastImportInfo,
}) => {
  const greeting = getGreeting();

  return (
    <div className="grid gap-6 md:grid-cols-12">
      {/* Left: Greeting */}
      <div className="md:col-span-6">
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-slate-100">
          {greeting}
        </h1>
      </div>

      {/* Right: Filters & Meta */}
      <div className="md:col-span-6 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select
            label="Konten"
            icon={<Filter className="h-3.5 w-3.5" aria-hidden="true" />}
            value={selectedAccount}
            onChange={event => onSelectAccount(event.target.value)}
            options={accounts}
          />
          <Select
            label="Zeitraum"
            icon={<Filter className="h-3.5 w-3.5" aria-hidden="true" />}
            value={selectedPeriod.id}
            onChange={event => onSelectPeriod(event.target.value as PeriodOption['id'])}
            options={periodOptions}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              onClick={onUploadClick}
            >
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
              <span>CSV Upload</span>
            </button>
            <button
              type="button"
              className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                hasWarnings
                  ? 'border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200'
                  : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
              }`}
              aria-label="Parser-Hinweise anzeigen"
              onClick={onWarningsClick}
            >
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              {hasWarnings ? (
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                  {warningsCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>
        {lastImportInfo && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{lastImportInfo}</p>
        )}
      </div>
    </div>
  );
};

type SelectProps = {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
  options: Array<{ id: string; label: string }>;
};

function Select({ label, icon, value, onChange, options }: SelectProps) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm transition focus-within:border-indigo-300 focus-within:ring-1 focus-within:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:focus-within:ring-indigo-500/40">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
        {icon}
      </span>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={onChange}
        className="w-full appearance-none bg-transparent text-sm font-medium text-slate-700 outline-none dark:text-slate-200"
      >
        {options.map(option => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

