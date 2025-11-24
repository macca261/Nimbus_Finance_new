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
  noCard?: boolean;
  noHeader?: boolean;
};

type ViewMode = 'balance' | 'cashflow';

export const DashboardBalanceChart: React.FC<DashboardBalanceChartProps> = ({ balance, cashflow, loading, noCard, noHeader }) => {
  const [view, setView] = useState<ViewMode>('balance');

  const balanceData = useMemo(
    () =>
      balance.map(point => ({
        date: point.date,
        balance: point.balance,
      })),
    [balance],
  );

  const content = (
    <>
      {!noHeader && (
        <header className="mb-4 flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Saldo & Cashflow</h3>
          </div>
          <div className="flex rounded-full border border-slate-200 bg-slate-100/60 p-1 text-xs font-medium dark:border-slate-700 dark:bg-slate-900/60">
            <ToggleButton active={view === 'balance'} label="Saldo" onClick={() => setView('balance')} />
            <ToggleButton active={view === 'cashflow'} label="Cashflow" onClick={() => setView('cashflow')} />
          </div>
        </header>
      )}
      <div className="flex-1">
        {view === 'balance' ? (
          <BalanceAreaChart data={balanceData} loading={loading} />
        ) : (
          <CashflowChart data={cashflow} />
        )}
      </div>
    </>
  );

  if (noCard) {
    return <div className="flex h-full min-h-[260px] flex-col">{content}</div>;
  }

  return (
    <div className="flex h-full min-h-[260px] flex-col rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm p-4 shadow-elevated dark:shadow-elevated sm:p-5 lg:p-6">
      {content}
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
    <div className="flex min-h-[260px] w-full items-center justify-center sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 8 }} className="sm:!mr-6">
          <defs>
            <linearGradient id="dashboardBalanceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5B8DEF" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#5B8DEF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 10 }} 
            tickLine={false} 
            axisLine={false}
            className="text-xs text-slate-500 dark:text-slate-400"
          />
          <YAxis
            width={56}
            tick={{ fontSize: 10 }}
            tickFormatter={value => formatCurrency(Number(value)).replace('€', '')}
            className="tabular-nums text-xs text-slate-500 dark:text-slate-400 sm:w-16"
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


