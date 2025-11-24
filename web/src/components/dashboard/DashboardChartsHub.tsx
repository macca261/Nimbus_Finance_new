import React, { useState } from 'react';
import { DashboardBalanceChart } from './DashboardBalanceChart';
import { CategoryDonutWithNavigation } from './CategoryDonutWithNavigation';
import { MonthlyIncomeExpenseChart } from './MonthlyIncomeExpenseChart';
import type { DashboardSummary } from '../../hooks/useDashboardData';
import type { CategorySlice } from './CategoryDonutWithNavigation';

type ChartTab = 'balance' | 'categories' | 'incomeExpense';

type DashboardChartsHubProps = {
  balance: DashboardSummary['balanceOverTime'];
  cashflow: DashboardSummary['cashflowByMonth'];
  categorySlices: CategorySlice[];
  loading?: boolean;
  dateRangeLabel: string;
  onCategoryClick: (categoryId: string) => void;
  insights: any; // MonthlyInsights - removed from here since MonthlySnapshotCard is now separate
};

export function DashboardChartsHub({
  balance,
  cashflow,
  categorySlices,
  loading,
  dateRangeLabel,
  onCategoryClick,
}: DashboardChartsHubProps) {
  const [activeTab, setActiveTab] = useState<ChartTab>('balance');

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-base font-semibold text-nf-text-main">Verlauf & Kategorien</h2>
        </div>
        <div className="inline-flex rounded-lg border border-nf-border-subtle bg-nf-bg-card-subtle p-1 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('balance')}
              className={`px-3 py-1.5 rounded-md transition text-xs font-medium ${
                activeTab === 'balance'
                  ? 'bg-nf-primary text-white shadow-sm'
                  : 'text-nf-text-muted hover:text-nf-text-main'
              }`}
            >
              Cashflow
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('categories')}
              className={`px-3 py-1.5 rounded-md transition text-xs font-medium ${
                activeTab === 'categories'
                  ? 'bg-nf-primary text-white shadow-sm'
                  : 'text-nf-text-muted hover:text-nf-text-main'
              }`}
            >
              Kategorien
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('incomeExpense')}
              className={`px-3 py-1.5 rounded-md transition text-xs font-medium ${
                activeTab === 'incomeExpense'
                  ? 'bg-nf-primary text-white shadow-sm'
                  : 'text-nf-text-muted hover:text-nf-text-main'
              }`}
            >
              Ein/Aus
            </button>
        </div>
      </div>

      <div className="flex-1 min-h-[320px]">
        {activeTab === 'balance' ? (
          <div className="h-full">
            <DashboardBalanceChart
              balance={balance}
              cashflow={cashflow}
              loading={loading}
              noCard
              noHeader
            />
          </div>
        ) : activeTab === 'categories' ? (
          <div className="h-full">
            <CategoryDonutWithNavigation
              data={categorySlices}
              loading={loading}
              dateRangeLabel={dateRangeLabel}
              onCategoryClick={onCategoryClick}
              noCard
              noHeader
            />
          </div>
        ) : (
          <div className="h-full">
            <MonthlyIncomeExpenseChart noCard noHeader />
          </div>
        )}
      </div>
    </div>
  );
}
