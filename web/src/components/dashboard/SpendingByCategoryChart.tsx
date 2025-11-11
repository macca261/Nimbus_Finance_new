import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import type { DashboardSummary } from '../../api/dashboard';
import { formatCurrency, formatPercent } from '../../lib/format';

type SpendingByCategoryChartProps = {
  data: DashboardSummary['spendingByCategory'];
};

const COLORS = ['#6366F1', '#0EA5E9', '#22C55E', '#F97316', '#EC4899', '#14B8A6', '#FACC15', '#8B5CF6'];

const EmptyState = () => (
  <div className="flex h-64 items-center justify-center text-sm text-slate-500">
    Noch keine Ausgaben analysierbar.
  </div>
);

export function SpendingByCategoryChart({ data }: SpendingByCategoryChartProps) {
  if (!data.length) {
    return <EmptyState />;
  }

  const total = data.reduce((acc, item) => acc + item.amount, 0);
  if (total <= 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="label"
              innerRadius={70}
              outerRadius={105}
              paddingAngle={3}
            >
              {data.map((slice, index) => (
                <Cell key={slice.category} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, _name, entry) => {
                const amount = Number(value ?? 0);
                const share = total ? amount / total : 0;
                return [`${formatCurrency(amount)} · ${formatPercent(share)}`, (entry?.payload as any)?.label];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-2 text-sm">
        {data.map((slice, index) => (
          <li key={slice.category} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                aria-hidden
              />
              <span className="font-medium text-slate-700">{slice.label}</span>
            </div>
            <div className="text-right text-sm text-slate-600">
              <div className="font-semibold text-slate-800">{formatCurrency(slice.amount)}</div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{formatPercent(slice.share)}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}


