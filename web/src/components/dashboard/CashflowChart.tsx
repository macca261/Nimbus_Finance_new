import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import type { DashboardSummary } from '../../api/dashboard';
import { formatCurrency } from '../../lib/format';

type CashflowChartProps = {
  data: DashboardSummary['cashflowByMonth'];
};

export function CashflowChart({ data }: CashflowChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        Noch keine Cashflow-Daten verfügbar.
      </div>
    );
  }

  const chartData = data.map(item => ({
    month: item.month,
    income: item.income,
    expenses: -item.expenses,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={value => formatCurrency(Number(value))}
            width={90}
            tick={{ fontSize: 12, fill: '#475569' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number, key) => {
              const amount = Number(value ?? 0);
              const label = key === 'income' ? 'Einnahmen' : 'Ausgaben';
              return [formatCurrency(Math.abs(amount)), label];
            }}
            labelFormatter={value => value}
          />
          <ReferenceLine y={0} stroke="#94A3B8" strokeDasharray="3 3" />
          <Bar dataKey="income" name="Einnahmen" fill="#22C55E" radius={[6, 6, 0, 0]} />
          <Bar dataKey="expenses" name="Ausgaben" fill="#F97316" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}


