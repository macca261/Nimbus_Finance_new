import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { formatCurrency, formatPercent } from '../../lib/format';
import { getCategoryMeta } from '../../lib/categories';

type CategoryData = {
  id: string;
  label: string;
  total: number;
};

type CategoryDonutChartProps = {
  data: CategoryData[];
  loading?: boolean;
  periodLabel: string;
};

export const CategoryDonutChart: React.FC<CategoryDonutChartProps> = ({ data, loading, periodLabel }) => {
  const total = data.reduce((sum, item) => sum + item.total, 0);
  const topCategories = data.slice(0, 8).map(item => ({
    ...item,
    share: total > 0 ? item.total / total : 0,
  }));

  return (
    <div className="flex flex-col">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-nf-text-main">Ausgaben nach Kategorie</h3>
        <p className="text-xs text-nf-text-muted">Letzte {periodLabel}</p>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-sm text-nf-text-muted">
          Lade Daten…
        </div>
      ) : topCategories.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-nf-text-muted">
          Noch keine Ausgaben-Daten.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 lg:gap-8">
          {/* Donut Chart - Larger and more prominent, takes more space */}
          <div className="flex-1 min-h-[400px] lg:min-h-[450px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topCategories}
                  dataKey="total"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius="45%"
                  outerRadius="85%"
                  paddingAngle={2}
                  label={false}
                >
                  {topCategories.map((item, index) => {
                    const meta = getCategoryMeta(item.id);
                    return <Cell key={`cell-${index}`} fill={meta.color} />;
                  })}
                </Pie>
                <Tooltip
                  formatter={(value: number) => {
                    const item = topCategories.find(d => d.total === value);
                    const share = item ? item.share : 0;
                    return `${formatCurrency(value)} (${formatPercent(share)})`;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend - Right side, compact but readable */}
          <div className="flex flex-col gap-2 lg:min-w-[240px]">
            {topCategories.map(item => {
              const meta = getCategoryMeta(item.id);
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-nf-border-subtle bg-nf-bg-card-subtle px-3 py-2 text-sm"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-lg text-xs"
                      style={{ background: `${meta.color}33`, color: meta.color }}
                    >
                      •
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-nf-text-main" title={item.label}>
                        {item.label}
                      </p>
                      <p className="truncate text-xs text-nf-text-muted tabular-nums">
                        {formatCurrency(item.total)}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-medium tabular-nums text-nf-text-main">
                    {formatPercent(item.share)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

