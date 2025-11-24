import React, { useState } from 'react';
import { Legend, Pie, PieChart, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { formatCurrency, formatPercent } from '../../lib/format';
import { getCategoryMeta } from '../../lib/categories';

export type CategorySlice = { id: string; label: string; total: number };

type CategoryDonutWithNavigationProps = {
  data: CategorySlice[];
  loading?: boolean;
  dateRangeLabel: string;
  onCategoryClick: (categoryId: string) => void;
  noCard?: boolean;
  noHeader?: boolean;
};

// Internal transfer categories that should be excluded from spending donut
const INTERNAL_TRANSFER_CATEGORIES = [
  'internal:transfer_savings',
  'internal:transfer_wallet',
  'internal:transfer_other',
  'internal:own-account',
  'transfer_internal',
];

function isInternalTransferCategory(categoryId: string): boolean {
  return INTERNAL_TRANSFER_CATEGORIES.includes(categoryId) || categoryId.startsWith('internal:transfer_');
}

export const CategoryDonutWithNavigation: React.FC<CategoryDonutWithNavigationProps> = ({
  data,
  loading,
  dateRangeLabel,
  onCategoryClick,
  noCard,
  noHeader,
}) => {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  // Filter out internal transfer categories and zero amounts
  const filtered = data.filter(slice => slice.total > 0 && !isInternalTransferCategory(slice.id));
  const total = filtered.reduce((sum, slice) => sum + slice.total, 0);

  const topFive = filtered
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map(slice => ({
      ...slice,
      share: total > 0 ? slice.total / total : 0,
    }));

  const content = (
    <>
      {!noHeader && (
        <div className="mb-4 space-y-1">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Ausgaben nach Kategorie</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Letzte {dateRangeLabel}</p>
        </div>
      )}

      {/* Grid layout: donut on left, legend on right - reduces whitespace */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 lg:gap-8">
        {/* Donut Chart - Larger and more prominent, takes more space */}
        <div className="flex min-h-[400px] lg:min-h-[450px] flex-1 items-center justify-center">
          {loading ? (
            <div className="flex h-72 items-center justify-center text-xs text-slate-500 dark:text-slate-400">
              Lade Daten…
            </div>
          ) : !filtered.length ? (
            <div className="flex h-72 items-center justify-center text-xs text-slate-500 dark:text-slate-400">
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
                  innerRadius="45%"
                  outerRadius="85%"
                  paddingAngle={1}
                  label={false}
                  labelLine={false}
                  minAngle={3}
                  isAnimationActive={false}
                  onMouseEnter={(_, index) => {
                    const slice = filtered[index];
                    if (slice) setHoveredCategory(slice.id);
                  }}
                  onMouseLeave={() => setHoveredCategory(null)}
                  onClick={(_, index) => {
                    const slice = filtered[index];
                    if (slice) onCategoryClick(slice.id);
                  }}
                >
                  {filtered.map(slice => {
                    const meta = getCategoryMeta(slice.id);
                    const isHovered = hoveredCategory === slice.id;
                    return (
                      <Cell
                        key={slice.id}
                        fill={meta.color}
                        opacity={isHovered ? 1 : hoveredCategory ? 0.3 : 1}
                        style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                      />
                    );
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
                    outline: 'none',
                  }}
                  formatter={(value: any, _name: any, payload: any) => {
                    const slice = payload?.payload as CategorySlice | undefined;
                    if (!slice) return '';
                    const share = total > 0 ? slice.total / total : 0;
                    return `${formatCurrency(Number(value))} (${formatPercent(share)})`;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Legend - Right side, compact but readable */}
        <ul className="flex flex-col gap-1.5 sm:gap-2.5 lg:min-w-[240px]">
          {topFive.map(slice => {
            const meta = getCategoryMeta(slice.id);
            const isHovered = hoveredCategory === slice.id;
            return (
              <li
                key={slice.id}
                onClick={() => onCategoryClick(slice.id)}
                onMouseEnter={() => setHoveredCategory(slice.id)}
                onMouseLeave={() => setHoveredCategory(null)}
                className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                  isHovered
                    ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-500/10'
                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60'
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-lg text-xs sm:h-6 sm:w-6"
                    style={{ background: `${meta.color}33`, color: meta.color }}
                  >
                    {meta.icon ?? '•'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate font-medium text-slate-900 dark:text-slate-100"
                      title={slice.label || meta.label || slice.id}
                    >
                      {slice.label || meta.label || slice.id}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400 tabular-nums" title={formatCurrency(slice.total)}>
                      {formatCurrency(slice.total)}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-medium tabular-nums text-slate-600 dark:text-slate-300 sm:ml-2">
                  {formatPercent(slice.share)}
                </span>
              </li>
            );
          })}
          {!topFive.length && !loading ? (
            <li className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
              Noch keine Ausgaben erfasst.
            </li>
          ) : null}
        </ul>
      </div>
      {!noHeader && (
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 text-center">
          Interne Überträge werden getrennt angezeigt und nicht als Ausgaben gezählt.
        </p>
      )}
    </>
  );

  if (noCard) {
    return <div className="flex min-h-[260px] flex-col">{content}</div>;
  }

  return (
    <div className="flex min-h-[260px] flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5 lg:p-6">
      {content}
    </div>
  );
};

