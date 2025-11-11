import React from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Card from '../ui/Card';
import { formatCurrency } from '../../lib/format';

export type BalancePoint = { date: string; balance: number };

type BalanceChartProps = {
  data: BalancePoint[];
  loading?: boolean;
};

export const BalanceChart: React.FC<BalanceChartProps> = ({ data, loading }) => {
  return (
    <Card className="h-full shadow-soft">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Verlauf Kontostand</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Letzte Bewegungen</p>
        </div>
      </div>
      <div className="mt-4 h-48">
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-500 dark:text-slate-400">
            Lade Daten…
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-500 dark:text-slate-400">
            Noch keine Daten vorhanden.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5B8DEF" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#5B8DEF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'var(--axis-color)' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                width={48}
                tick={{ fontSize: 10, fill: 'var(--axis-color)' }}
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
              <Area type="monotone" dataKey="balance" stroke="#5B8DEF" strokeWidth={2} fill="url(#balanceGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
};
