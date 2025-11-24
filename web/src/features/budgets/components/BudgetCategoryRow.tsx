import React from 'react';
import type { BudgetCategoryAllocation } from '../../../types/budgets';
import { formatCurrency } from '../../../lib/format';
import { getCategoryLabel } from '../../../lib/categories';

interface BudgetCategoryRowProps {
  allocation: BudgetCategoryAllocation;
}

export const BudgetCategoryRow: React.FC<BudgetCategoryRowProps> = ({ allocation }) => {
  const {
    categoryId,
    plannedCents,
    spentCents = 0,
    remainingCents = plannedCents - spentCents,
    progressPercent = 0,
    isOverspent = false,
  } = allocation;

  const categoryLabel = getCategoryLabel(categoryId);
  const progress = Math.min(100, Math.max(0, progressPercent));

  return (
    <div className="p-5 sm:p-6 hover:bg-nf-bg-card-subtle transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-nf-text-main mb-1">{categoryLabel}</h3>
          <div className="flex items-center gap-4 text-xs text-nf-text-muted">
            <span>Geplant: {formatCurrency(plannedCents / 100)}</span>
            <span>Ausgegeben: {formatCurrency(spentCents / 100)}</span>
          </div>
        </div>
        <div className="text-right">
          <p
            className={`text-lg font-semibold tabular-nums ${
              isOverspent ? 'text-nf-negative' : remainingCents >= 0 ? 'text-nf-positive' : 'text-nf-text-main'
            }`}
          >
            {formatCurrency(remainingCents / 100)}
          </p>
          <p className="text-xs text-nf-text-muted mt-1">{progress.toFixed(0)}%</p>
        </div>
      </div>
      <div className="mt-3 h-2 bg-nf-bg-card-subtle rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${
            isOverspent ? 'bg-nf-negative' : 'bg-nf-primary'
          }`}
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
    </div>
  );
};

