import React from 'react';
import { Plus, Upload, Eye } from 'lucide-react';
import { formatCurrency } from '../../lib/format';
import type { DashboardSummary } from '../../hooks/useDashboardData';

export interface DashboardCockpitProps {
  userName?: string | null;
  currentBalance?: number;
  income30d?: number;
  expenses30d?: number;
  balanceOverTime?: DashboardSummary['balanceOverTime'];
  loading?: boolean;
  onConnectAccount?: () => void;
  onUploadCsv?: () => void;
  onViewDemo?: () => void;
  reviewCounts?: {
    uncategorized: number;
    lowConfidence: number;
  };
  showSonstiges?: boolean;
}

export const DashboardCockpit: React.FC<DashboardCockpitProps> = ({
  userName,
  currentBalance = 0,
  income30d = 0,
  expenses30d = 0,
  balanceOverTime,
  loading = false,
  onConnectAccount,
  onUploadCsv,
  onViewDemo,
  reviewCounts,
  showSonstiges = false,
}) => {
  const name = userName ?? 'Nimbus Nutzer';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Segment 1: Identity + Actions (5 cols) */}
      <div className="lg:col-span-5 rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-5 sm:p-6 lg:p-7 shadow-elevated transition-all duration-200 ease-out hover:-translate-y-[1px] hover:shadow-xl">
        <p className="text-[11px] uppercase tracking-wide text-nf-text-muted mb-2">
          Dashboard · Heute
        </p>
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-nf-text-main mb-2">
          {name}
        </h1>
        <p className="text-sm text-nf-text-muted mb-5">
          Dein Geld auf einen Blick für die letzten 30 Tage.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onConnectAccount}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-nf-primary text-white text-xs font-medium hover:bg-nf-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Konto</span>
          </button>
          <button
            type="button"
            onClick={onUploadCsv}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-nf-border-subtle bg-nf-bg-card text-nf-text-main text-xs font-medium hover:bg-nf-bg-card-subtle transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={onViewDemo}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-nf-text-muted text-xs font-medium hover:text-nf-text-main transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Demo</span>
          </button>
        </div>
      </div>

      {/* Segment 2: Net Position (4 cols) - Visually Heavy */}
      <div className="lg:col-span-4 rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-5 sm:p-6 lg:p-7 shadow-elevated transition-all duration-200 ease-out hover:-translate-y-[1px] hover:shadow-xl">
        <p className="text-[11px] uppercase tracking-wide text-nf-text-muted mb-3">
          Balance
        </p>
        <div className="mb-4">
          <p className={`text-2xl lg:text-3xl font-semibold tracking-tight tabular-nums ${
            currentBalance < 0 ? 'text-nf-negative' : 'text-nf-text-main'
          }`}>
            {loading ? '—' : formatCurrency(currentBalance)}
          </p>
        </div>
        {(income30d > 0 || expenses30d > 0) && (
          <div className="flex items-center gap-4 pt-3 border-t border-nf-border-subtle">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-nf-positive" />
              <span className="text-xs text-nf-text-muted tabular-nums">
                {formatCurrency(income30d)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-nf-negative" />
              <span className="text-xs text-nf-text-muted tabular-nums">
                {formatCurrency(expenses30d)}
              </span>
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-nf-text-soft">
          Stand: Letzte 30 Tage
        </p>
      </div>

      {/* Segment 3: Health Donut + Quick Legend (3 cols) */}
      <div className="lg:col-span-3 rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-5 sm:p-6 lg:p-7 shadow-elevated transition-all duration-200 ease-out hover:-translate-y-[1px] hover:shadow-xl">
        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-wide text-nf-text-muted mb-1">
            Money Health
          </p>
          <p className="text-[10px] text-nf-text-soft">
            Letzte 90 Tage
          </p>
        </div>
        <div className="relative h-20 w-20 mx-auto mb-3">
          <svg className="absolute inset-0 -rotate-90 transform" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-nf-border-subtle"
            />
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeDasharray={`${2 * Math.PI * 36}`}
              strokeDashoffset={`${2 * Math.PI * 36 * (1 - 0.82)}`}
              strokeLinecap="round"
              className="text-nf-positive transition-all duration-1000 ease-out"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center tabular-nums text-lg font-bold text-nf-positive">
            82%
          </span>
        </div>
        <p className="text-center text-xs text-nf-text-muted">
          Basierend auf deinen letzten 90 Tagen.
        </p>
      </div>
    </div>
  );
};

