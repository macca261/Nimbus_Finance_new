import { useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import { formatCurrency, formatPercent } from '../../lib/format';

const COLORS = [
  '#6366F1',
  '#0EA5E9',
  '#22C55E',
  '#F97316',
  '#EC4899',
  '#14B8A6',
  '#FACC15',
  '#8B5CF6',
];

export type SpendingCategoryDatum = {
  category: string;
  label: string;
  amount: number;
  share: number;
};

type SpendingByCategoryChartProps = {
  data: SpendingCategoryDatum[];
};

export function SpendingByCategoryChart({ data }: SpendingByCategoryChartProps) {
  const total = useMemo(
    () => data.reduce((sum, slice) => sum + slice.amount, 0),
    [data],
  );

  if (!data.length || total === 0) {
    return (
      <div className="flex h-64 w-full items-center justify-center text-sm text-slate-500">
        Noch keine Ausgaben analysierbar.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="amount"
            nameKey="label"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={3}
          >
            {data.map((entry, index) => (
              <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name) => {
              const share = total ? formatPercent(value / total) : '—';
              return [`${formatCurrency(value)} (${share})`, name];
            }}
          />
          <Legend
            verticalAlign="bottom"
            align="center"
            formatter={(value, entry) => {
              const slice = entry.payload as SpendingCategoryDatum;
              return `${value} (${formatPercent(slice.share)})`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

