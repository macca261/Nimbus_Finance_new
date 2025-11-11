import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { formatCurrencyEUR } from '../../lib/format';
import { getCategoryColor } from '../../lib/colors';
import type { BalancePoint, CashflowPoint, CategorySlice } from '../../lib/derive';

type SpendingPieProps = { slices: CategorySlice[] };
export function SpendingPie({ slices }: SpendingPieProps) {
  const total = slices.reduce((a, b) => a + b.value, 0);
  if (!slices.length) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 shadow-soft border dark:border-neutral-800 text-sm text-neutral-500">
        Keine Ausgaben erkannt – lade eine CSV mit Buchungen.
      </div>
    );
  }
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 shadow-soft border dark:border-neutral-800">
      <div className="font-semibold mb-2">Spending by Category</div>
      <div className="h-64">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
              {slices.map((s, i) => <Cell key={i} fill={getCategoryColor(s.name)} />)}
            </Pie>
            <Tooltip formatter={(v: number, name: string) => [formatCurrencyEUR(v), name]} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="text-sm text-neutral-500 dark:text-neutral-400">Total: {formatCurrencyEUR(total)}</div>
    </div>
  );
}

type NetWorthBarsProps = { series: BalancePoint[] };
export function NetWorthBars({ series }: NetWorthBarsProps) {
  if (!series.length) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 shadow-soft border dark:border-neutral-800 text-sm text-neutral-500">
        Noch keine Zeitreihen – importiere CSVs mit mehreren Monaten.
      </div>
    );
  }
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 shadow-soft border dark:border-neutral-800">
      <div className="font-semibold mb-2">Net Worth</div>
      <div className="h-64">
        <ResponsiveContainer>
          <BarChart data={series}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(v: number) => formatCurrencyEUR(v)} />
            <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#5B8DEF" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

type CashflowBarsProps = { points: CashflowPoint[] };
export function CashflowBars({ points }: CashflowBarsProps) {
  if (!points.length) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 shadow-soft border dark:border-neutral-800 text-sm text-neutral-500">
        Noch keine Cashflow-Daten vorhanden.
      </div>
    );
  }
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 shadow-soft border dark:border-neutral-800">
      <div className="font-semibold mb-2">Cash Flow</div>
      <div className="h-64">
        <ResponsiveContainer>
          <BarChart data={points}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(v: number) => formatCurrencyEUR(v)} />
            <Bar dataKey="income" radius={[8, 8, 0, 0]} fill="#10b981" />
            <Bar dataKey="expense" radius={[8, 8, 0, 0]} fill="#f87171" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
