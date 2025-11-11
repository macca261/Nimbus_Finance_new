import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import type { BalancePoint } from '../../lib/derive';
import { formatCurrencyEUR } from '../../lib/format';

type BalanceLineProps = {
  data: BalancePoint[];
};

export function BalanceLine({ data }: BalanceLineProps) {
  if (!data.length) {
    return (
      <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
        Keine Saldenhistorie vorhanden.
      </div>
    );
  }

  return (
    <div className="h-60">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="4 4" stroke="#CBD5F5" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value: number) => formatCurrencyEUR(value)} />
          <Line type="monotone" dataKey="balance" stroke="#6366F1" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}


