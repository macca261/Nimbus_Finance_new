import { ResponsiveContainer, PieChart, Pie, Tooltip, Cell, Legend } from 'recharts';
import type { CategoryTotal } from '../../lib/derive';
import { formatCurrencyEUR } from '../../lib/format';

const COLORS = ['#6366F1', '#0EA5E9', '#22C55E', '#F97316', '#EC4899', '#14B8A6', '#FACC15'];

type SpendingPieProps = {
  data: CategoryTotal[];
};

export function SpendingPie({ data }: SpendingPieProps) {
  if (!data.length) {
    return (
      <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
        Keine Ausgaben verfügbar.
      </div>
    );
  }

  return (
    <div className="h-60">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => formatCurrencyEUR(value)} />
          <Legend layout="vertical" align="right" verticalAlign="middle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}


