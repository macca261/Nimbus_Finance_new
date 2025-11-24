import React, { useMemo } from 'react';
import { formatCurrency } from '../../lib/format';
import type { ApiTransaction } from '../../pages/Transactions';

type TransactionsHeaderStripProps = {
  transactions: ApiTransaction[];
  total: number;
  filters: {
    startDate?: string;
    endDate?: string;
    category?: string;
    accountId?: string;
  };
  onAccountFilterChange?: (accountId: string | undefined) => void;
  onTimeFilterChange?: (days: number | 'all') => void;
  loading?: boolean;
};

export const TransactionsHeaderStrip: React.FC<TransactionsHeaderStripProps> = ({
  transactions,
  total,
  filters,
  onAccountFilterChange,
  onTimeFilterChange,
  loading = false,
}) => {
  // Calculate quick stats from visible transactions
  const stats = useMemo(() => {
    const income = transactions
      .filter(tx => tx.amount > 0)
      .reduce((sum, tx) => sum + tx.amount, 0);
    const expenses = transactions
      .filter(tx => tx.amount < 0)
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const netto = income - expenses;
    return { income, expenses, netto };
  }, [transactions]);

  // Generate period description
  const periodDescription = useMemo(() => {
    const parts: string[] = [];
    if (filters.accountId) {
      parts.push('Ausgewähltes Konto');
    } else {
      parts.push('Alle Konten');
    }
    if (filters.startDate || filters.endDate) {
      if (filters.startDate && filters.endDate) {
        parts.push(`${filters.startDate} - ${filters.endDate}`);
      } else if (filters.startDate) {
        parts.push(`Ab ${filters.startDate}`);
      } else if (filters.endDate) {
        parts.push(`Bis ${filters.endDate}`);
      }
    } else {
      parts.push('Letzte 90 Tage');
    }
    return parts.join(' · ');
  }, [filters]);

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-nf-border-subtle bg-nf-bg-card shadow-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Left: Title & Period */}
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold tracking-tight text-nf-text-main">
          Deine Buchungen
        </h2>
        <p className="text-xs text-nf-text-muted">{periodDescription}</p>
      </div>

      {/* Middle: Quick Stats */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-nf-bg-card-subtle px-3 py-1 text-xs font-medium text-nf-text-main">
          Einnahmen: {loading ? '—' : formatCurrency(stats.income)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-nf-bg-card-subtle px-3 py-1 text-xs font-medium text-nf-text-main">
          Ausgaben: {loading ? '—' : formatCurrency(stats.expenses)}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-nf-bg-card-subtle px-3 py-1 text-xs font-medium ${
            stats.netto >= 0 ? 'text-nf-positive' : 'text-nf-negative'
          }`}
        >
          Netto: {loading ? '—' : formatCurrency(stats.netto)}
        </span>
      </div>

      {/* Right: Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Account filter - placeholder for now */}
        {onAccountFilterChange && (
          <button
            type="button"
            className="inline-flex items-center rounded-full border border-nf-border-subtle bg-nf-bg-card px-3 py-1 text-xs font-medium text-nf-text-main shadow-xs hover:border-nf-primary hover:text-nf-primary transition-colors"
          >
            Alle Konten
          </button>
        )}

        {/* Time filter chips */}
        {onTimeFilterChange && (
          <>
            <button
              type="button"
              onClick={() => onTimeFilterChange(30)}
              className="inline-flex items-center rounded-full border border-nf-border-subtle bg-nf-bg-card px-3 py-1 text-xs font-medium text-nf-text-main shadow-xs hover:border-nf-primary hover:text-nf-primary transition-colors"
            >
              30 Tage
            </button>
            <button
              type="button"
              onClick={() => onTimeFilterChange(90)}
              className="inline-flex items-center rounded-full border border-nf-border-subtle bg-nf-bg-card px-3 py-1 text-xs font-medium text-nf-text-main shadow-xs hover:border-nf-primary hover:text-nf-primary transition-colors"
            >
              90 Tage
            </button>
            <button
              type="button"
              onClick={() => onTimeFilterChange('all')}
              className="inline-flex items-center rounded-full border border-nf-border-subtle bg-nf-bg-card px-3 py-1 text-xs font-medium text-nf-text-main shadow-xs hover:border-nf-primary hover:text-nf-primary transition-colors"
            >
              Dieses Jahr
            </button>
          </>
        )}
      </div>
    </div>
  );
};

