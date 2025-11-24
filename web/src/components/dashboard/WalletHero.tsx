import React from 'react';
import { Plus, Upload, Eye, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '../../lib/format';
import { MiniCashflowSparkline } from './MiniCashflowSparkline';
import type { DashboardSummary } from '../../hooks/useDashboardData';

export interface WalletHeroProps {
  userName?: string | null;
  primaryAccountLabel?: string | null;
  currentBalance?: number;
  income30d?: number;
  expenses30d?: number;
  balanceOverTime?: DashboardSummary['balanceOverTime'];
  loading?: boolean;
  onConnectAccount?: () => void;
  onUploadCsv?: () => void;
  onViewDemo?: () => void;
}

export const WalletHero: React.FC<WalletHeroProps> = ({
  userName,
  currentBalance = 0,
  income30d = 0,
  expenses30d = 0,
  balanceOverTime = [],
  loading = false,
  onConnectAccount,
  onUploadCsv,
  onViewDemo,
}) => {
  const name = userName ?? 'Nimbus Nutzer';
  const netCashflow = income30d - expenses30d;
  const isPositive = netCashflow >= 0;

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      {/* Left: Wallet Card */}
      <div className="group relative rounded-2xl bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 border border-slate-200/60 dark:border-slate-700/60 p-6 lg:p-8 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05]">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
            backgroundSize: '24px 24px'
          }} />
        </div>

        <div className="relative">
          {/* Minimal header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                Dashboard
              </p>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                {name}
              </h1>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 mb-8">
            <button
              type="button"
              onClick={onConnectAccount}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-900 text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Konto</span>
            </button>
            <button
              type="button"
              onClick={onUploadCsv}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <Upload className="h-4 w-4" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={onViewDemo}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-slate-600 dark:text-slate-400 text-sm font-medium hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            >
              <Eye className="h-4 w-4" />
              <span>Demo</span>
            </button>
          </div>

          {/* Money Snapshot */}
          {(income30d > 0 || expenses30d > 0 || balanceOverTime.length > 0) && (
            <div className="space-y-4 pt-6 border-t border-slate-200/60 dark:border-slate-700/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Einnahmen</p>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-lg font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatCurrency(income30d)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Ausgaben</p>
                    <div className="flex items-center gap-1.5">
                      <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                      <span className="text-lg font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                        {formatCurrency(expenses30d)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0 w-32">
                  <MiniCashflowSparkline balance={balanceOverTime} loading={loading} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Snapshot Stack */}
      <div className="flex flex-col gap-3">
        {/* Money Health Card */}
        <div className="rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 p-5 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Health
            </p>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">82%</span>
          </div>
          <div className="relative h-16 w-full">
            <svg className="absolute inset-0 -rotate-90 transform" viewBox="0 0 64 64">
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-slate-100 dark:text-slate-700"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - 0.82)}`}
                strokeLinecap="round"
                className="text-emerald-500 dark:text-emerald-400 transition-all duration-1000 ease-out"
              />
            </svg>
          </div>
        </div>

        {/* Tasks Card */}
        <div className="rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 p-5 shadow-sm hover:shadow-md transition-all duration-200">
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-4">
            Tasks
          </p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-sm text-slate-700 dark:text-slate-300">Erstattungen</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-indigo-500" />
              <span className="text-sm text-slate-700 dark:text-slate-300">Sonstiges</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
              <span className="text-sm text-slate-700 dark:text-slate-300">Verträge</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
