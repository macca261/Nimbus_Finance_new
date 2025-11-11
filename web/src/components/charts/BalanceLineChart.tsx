import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { formatCurrency } from '../../lib/format';

type BalanceLineChartProps = {
  data: Array<{ date: string; balance: number }>;
};

export function BalanceLineChart({ data }: BalanceLineChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-64 w-full items-center justify-center text-sm text-slate-500">
        Keine Verlaufsdaten vorhanden.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value: number) => formatCurrency(value)} />
          <Line
            type="monotone"
            dataKey="balance"
            stroke="#4F46E5"
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

