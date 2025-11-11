import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { CashflowChart } from './CashflowChart';
import type { DashboardSummary } from '../../hooks/useDashboardData';
import { formatCurrency } from '../../lib/format';

type DashboardBalanceChartProps = {
  balance: DashboardSummary['balanceOverTime'];
  cashflow: DashboardSummary['cashflowByMonth'];
  loading?: boolean;
};

type ViewMode = 'balance' | 'cashflow';

export const DashboardBalanceChart: React.FC<DashboardBalanceChartProps> = ({ balance, cashflow, loading }) => {
  const [view, setView] = useState<ViewMode>('balance');

  const balanceData = useMemo(
    () =>
      balance.map(point => ({
        date: point.date,
        balance: point.balance,
      })),
    [balance],
  );

  return (
    <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white/80 shadow-sm shadow-slate-500/10 dark:border-slate-800 dark:bg-slate-900/70">
      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Saldo & Cashflow</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Entwicklung im ausgewählten Zeitraum</p>
        </div>
        <div className="flex rounded-full border border-slate-200 bg-slate-100/60 p-1 text-xs font-medium dark:border-slate-700 dark:bg-slate-900/60">
          <ToggleButton active={view === 'balance'} label="Saldo" onClick={() => setView('balance')} />
          <ToggleButton active={view === 'cashflow'} label="Cashflow" onClick={() => setView('cashflow')} />
        </div>
      </header>
      <div className="flex-1 p-6">
        {view === 'balance' ? (
          <BalanceAreaChart data={balanceData} loading={loading} />
        ) : (
          <CashflowChart data={cashflow} />
        )}
      </div>
    </div>
  );
};

function BalanceAreaChart({ data, loading }: { data: { date: string; balance: number }[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-xs text-slate-500 dark:text-slate-400">
        Lade Daten…
      </div>
    );
  }
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-xs text-slate-500 dark:text-slate-400">
        Noch keine Daten vorhanden.
      </div>
    );
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 24, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="dashboardBalanceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5B8DEF" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#5B8DEF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
          <YAxis
            width={64}
            tick={{ fontSize: 10, fill: '#64748B' }}
            tickFormatter={value => formatCurrency(Number(value)).replace('€', '')}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--tooltip-bg)',
              border: '1px solid var(--tooltip-border)',
              borderRadius: 12,
              fontSize: 12,
              color: 'var(--tooltip-text)',
              boxShadow: '0 12px 24px rgba(15, 23, 42, 0.08)',
            }}
            formatter={(value: any) => formatCurrency(Number(value))}
          />
          <Area type="monotone" dataKey="balance" stroke="#5B8DEF" strokeWidth={2} fill="url(#dashboardBalanceGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ToggleButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 transition focus:outline-none ${
        active
          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
      }`}
    >
      {label}
    </button>
  );
}


