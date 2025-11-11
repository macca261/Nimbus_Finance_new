import { AreaChart, Area, ResponsiveContainer, Tooltip, CartesianGrid, XAxis, YAxis } from 'recharts';
import { formatCurrencyEUR } from '../../lib/format';
import type { BalancePoint, DerivedDashboard } from '../../lib/derive';

type KpiCardProps = {
  balanceSeries: BalancePoint[];
  totals: DerivedDashboard['totals'];
};

export default function KpiCard({ balanceSeries, totals }: KpiCardProps) {
  if (!balanceSeries.length) {
    return (
      <div className="rounded-2xl bg-white p-5 text-sm text-neutral-500 shadow-soft border border-dashed border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900">
        Noch keine Daten – lade eine CSV hoch, um KPIs zu sehen.
      </div>
    );
  }

  const value = balanceSeries.at(-1)!.value;
  const prev = balanceSeries.length > 1 ? balanceSeries.at(-2)!.value : 0;
  const diff = value - prev;
  const pct = prev !== 0 ? (diff / prev) * 100 : diff === 0 ? 0 : 100;

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 shadow-soft border dark:border-neutral-800">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-neutral-500 dark:text-neutral-400 text-sm">Gesamtsaldo</div>
          <div className="text-3xl font-semibold">{formatCurrencyEUR(value)}</div>
          <div className={`text-sm mt-1 ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {diff >= 0 ? '▲' : '▼'} {formatCurrencyEUR(Math.abs(diff))} ({pct.toFixed(1)}%)
          </div>
          <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            Monatlicher Nettozufluss: {formatCurrencyEUR(totals.latestMonthNet ?? 0)}
          </div>
        </div>
        <div className="w-64 h-24">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={balanceSeries}>
              <defs>
                <linearGradient id="bal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5B8DEF" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#5B8DEF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="month" hide />
              <YAxis hide />
              <Tooltip formatter={(value: number) => formatCurrencyEUR(value)} />
              <Area dataKey="value" type="monotone" stroke="#5B8DEF" fill="url(#bal)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
