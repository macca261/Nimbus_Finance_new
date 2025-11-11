import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
} from 'recharts';
import { formatCurrency } from '../../lib/format';

type CashflowByMonthChartProps = {
  data: Array<{ month: string; income: number; expenses: number }>;
};

export function CashflowByMonthChart({ data }: CashflowByMonthChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-64 w-full items-center justify-center text-sm text-slate-500">
        Noch keine Cashflow-Daten vorhanden.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip formatter={(value: number) => formatCurrency(value)} />
          <Legend />
          <Bar dataKey="income" fill="#22C55E" name="Einnahmen" />
          <Bar dataKey="expenses" fill="#F97316" name="Ausgaben" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

