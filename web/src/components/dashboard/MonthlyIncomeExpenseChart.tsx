import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useMonthlyIncomeExpense } from '../../lib/hooks/useMonthlyIncomeExpense';
import { formatCurrency } from '../../lib/format';

interface MonthlyIncomeExpenseChartProps {
  noCard?: boolean;
  noHeader?: boolean;
}

// Format month label (e.g., "2025-01" -> "Jan")
function formatMonthLabel(month: string): string {
  try {
    const [year, monthNum] = month.split('-');
    const monthIndex = parseInt(monthNum, 10) - 1;
    const date = new Date(parseInt(year, 10), monthIndex, 1);
    return date.toLocaleDateString('de-DE', { month: 'short' });
  } catch {
    return month;
  }
}

export const MonthlyIncomeExpenseChart: React.FC<MonthlyIncomeExpenseChartProps> = ({ noCard, noHeader }) => {
  const { data, isLoading, error } = useMonthlyIncomeExpense();

  const chartData = data.map(point => ({
    month: formatMonthLabel(point.month),
    monthFull: point.month,
    income: point.totalIncomeCents / 100, // Convert cents to euros
    expenses: point.totalExpenseCents / 100, // Convert cents to euros
  }));

  const content = (
    <>
      {!noHeader && (
        <div className="mb-4 space-y-1">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Einnahmen vs. Ausgaben (letzte 6 Monate)
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Monatlicher Vergleich</p>
        </div>
      )}

      <div className="flex-1 min-h-[220px]">
        {error ? (
          <div className="flex h-64 items-center justify-center text-xs text-slate-500 dark:text-slate-400">
            {error}
          </div>
        ) : isLoading ? (
          <div className="flex h-64 items-center justify-center text-xs text-slate-500 dark:text-slate-400">
            Lade Daten…
          </div>
        ) : !chartData.length ? (
          <div className="flex h-64 items-center justify-center text-xs text-slate-500 dark:text-slate-400">
            Noch keine Daten vorhanden.
          </div>
        ) : (
          <div className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%" minHeight={220}>
              <BarChart
                data={chartData}
                margin={{ top: 12, right: 12, left: 0, bottom: 8 }}
                className="sm:!mr-6"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  tickLine={false}
                  axisLine={false}
                  className="text-xs"
                />
                <YAxis
                  width={56}
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  tickFormatter={value => formatCurrency(Number(value)).replace('€', '')}
                  className="tabular-nums text-xs sm:w-16"
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
                  formatter={(value: number, name: string) => {
                    const label = name === 'income' ? 'Einnahmen' : 'Ausgaben';
                    return [formatCurrency(Number(value)), label];
                  }}
                  labelFormatter={value => {
                    const point = chartData.find(d => d.month === value);
                    return point ? point.monthFull : value;
                  }}
                />
                <Legend
                  formatter={(value: string) => {
                    return value === 'income' ? 'Einnahmen' : 'Ausgaben';
                  }}
                  iconType="rect"
                  wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                />
                <Bar
                  dataKey="income"
                  name="Einnahmen"
                  fill="#22C55E"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="expenses"
                  name="Ausgaben"
                  fill="#F97316"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </>
  );

  if (noCard) {
    return <div className="flex h-full min-h-[220px] flex-col">{content}</div>;
  }

  return (
    <div className="flex min-h-[220px] flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5 lg:p-6">
      {content}
    </div>
  );
};

