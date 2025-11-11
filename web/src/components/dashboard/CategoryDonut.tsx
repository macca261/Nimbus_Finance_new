import React from 'react';
import { Legend, Pie, PieChart, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import Card from '../ui/Card';
import { formatCurrency } from '../../lib/format';
import { getCategoryMeta } from '../../lib/categories';

export type CategorySlice = { id: string; label: string; total: number };

type CategoryDonutProps = {
  data: CategorySlice[];
  loading?: boolean;
};

export const CategoryDonut: React.FC<CategoryDonutProps> = ({ data, loading }) => {
  const filtered = data.filter(slice => slice.total > 0);

  return (
    <Card className="h-full shadow-soft">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ausgaben nach Kategorie</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Letzte 30 Tage</p>
        </div>
      </div>
      <div className="mt-4 h-48">
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-500 dark:text-slate-400">
            Lade Daten…
          </div>
        ) : !filtered.length ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-500 dark:text-slate-400">
            Noch keine Ausgaben-Daten.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={filtered}
                dataKey="total"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={70}
                paddingAngle={1}
              >
                {filtered.map(slice => {
                  const meta = getCategoryMeta(slice.id);
                  return <Cell key={slice.id} fill={meta.color} />;
                })}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--tooltip-bg)',
                  border: '1px solid var(--tooltip-border)',
                  borderRadius: 12,
                  fontSize: 12,
                  color: 'var(--tooltip-text)',
                  boxShadow: '0 12px 24px rgba(15, 23, 42, 0.08)',
                }}
                formatter={(value: any, _name: any, payload: any) =>
                  `${formatCurrency(Number(value))} • ${(payload?.payload?.label as string) || payload?.payload?.id || ''}`
                }
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                wrapperStyle={{ fontSize: 12, color: 'var(--axis-color)' }}
                formatter={(_value: any, entry: any) => {
                  const label =
                    filtered.find(slice => slice.id === entry?.value || slice.label === entry?.value)?.label ??
                    entry?.value;
                  return <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
};


