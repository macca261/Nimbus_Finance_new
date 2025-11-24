import React from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import type { DashboardSummary } from '../../hooks/useDashboardData';

type MiniCashflowSparklineProps = {
  balance: DashboardSummary['balanceOverTime'];
  loading?: boolean;
};

// Above-the-fold money snapshot: quick last-30-days summary to avoid empty hero space.
export const MiniCashflowSparkline: React.FC<MiniCashflowSparklineProps> = ({ balance, loading }) => {
  const chartData = React.useMemo(
    () =>
      balance.slice(-30).map(point => ({
        date: point.date,
        balance: point.balance,
      })),
    [balance],
  );

  if (loading || chartData.length === 0) {
    return (
      <div className="h-12 w-full rounded-lg bg-nf-bg-card-subtle flex items-center justify-center">
        <span className="text-xs text-nf-text-muted">Lade…</span>
      </div>
    );
  }

  return (
    <div className="h-12 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id="miniSparklineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--nf-primary)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--nf-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="balance"
            stroke="var(--nf-primary)"
            strokeWidth={1.5}
            fill="url(#miniSparklineGradient)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

