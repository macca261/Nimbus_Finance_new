import React from 'react';
import type { BudgetSummary } from '../../../types/budgets';
import { formatCurrency } from '../../../lib/format';

interface BudgetSummaryStripProps {
  summary: BudgetSummary;
}

export const BudgetSummaryStrip: React.FC<BudgetSummaryStripProps> = ({ summary }) => {
  const { totalPlannedCents, totalSpentCents, totalRemainingCents, overspendCount } = summary;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Planned */}
      <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-5 sm:p-6 shadow-elevated">
        <p className="text-[11px] uppercase tracking-wide text-nf-text-muted mb-2">Geplant</p>
        <p className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums text-nf-text-main">
          {formatCurrency(totalPlannedCents / 100)}
        </p>
      </div>

      {/* Total Spent */}
      <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-5 sm:p-6 shadow-elevated">
        <p className="text-[11px] uppercase tracking-wide text-nf-text-muted mb-2">Ausgegeben</p>
        <p className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums text-nf-text-main">
          {formatCurrency(totalSpentCents / 100)}
        </p>
      </div>

      {/* Remaining */}
      <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-5 sm:p-6 shadow-elevated">
        <p className="text-[11px] uppercase tracking-wide text-nf-text-muted mb-2">Verbleibend</p>
        <p
          className={`text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums ${
            totalRemainingCents < 0 ? 'text-nf-negative' : 'text-nf-positive'
          }`}
        >
          {formatCurrency(totalRemainingCents / 100)}
        </p>
      </div>

      {/* Overspend Count */}
      <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-5 sm:p-6 shadow-elevated">
        <p className="text-[11px] uppercase tracking-wide text-nf-text-muted mb-2">Überschreitungen</p>
        <p
          className={`text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums ${
            overspendCount > 0 ? 'text-nf-negative' : 'text-nf-text-main'
          }`}
        >
          {overspendCount}
        </p>
      </div>
    </div>
  );
};

