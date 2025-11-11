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
import type { CashflowPoint } from '../../lib/derive';
import { formatCurrencyEUR } from '../../lib/format';

type CashflowBarsProps = {
  data: CashflowPoint[];
};

export function CashflowBars({ data }: CashflowBarsProps) {
  if (!data.length) {
    return (
      <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
        Noch keine Cashflow-Daten.
      </div>
    );
  }

  return (
    <div className="h-60">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip formatter={(value: number) => formatCurrencyEUR(value)} />
          <Legend />
          <Bar dataKey="income" fill="#22C55E" name="Einnahmen" />
          <Bar dataKey="expenses" fill="#F97316" name="Ausgaben" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}


