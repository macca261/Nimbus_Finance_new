import React from 'react';
import type { BudgetSummary } from '../../../types/budgets';
import { BudgetCategoryRow } from './BudgetCategoryRow';

interface BudgetGridProps {
  summary: BudgetSummary;
  onEdit?: (budgetId: string) => void;
}

export const BudgetGrid: React.FC<BudgetGridProps> = ({ summary, onEdit }) => {
  const { allocations } = summary;

  if (allocations.length === 0) {
    return (
      <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-8 text-center text-nf-text-muted">
        Keine Kategorien in diesem Budget.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card shadow-elevated overflow-hidden">
      <div className="divide-y divide-nf-border-subtle">
        {allocations.map((allocation) => (
          <BudgetCategoryRow key={allocation.id} allocation={allocation} />
        ))}
      </div>
    </div>
  );
};

