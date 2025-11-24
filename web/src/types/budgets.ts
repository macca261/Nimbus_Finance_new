export type BudgetPeriod = 'monthly' | 'weekly' | 'yearly';

export interface BudgetCategoryAllocation {
  id: string;
  budgetId: string;
  categoryId: string;
  plannedCents: number;
  rolloverFromPrevious: boolean;
  spentCents?: number;
  remainingCents?: number;
  progressPercent?: number;
  isOverspent?: boolean;
}

export interface Budget {
  id: string;
  name: string;
  period: BudgetPeriod;
  periodValue: string; // e.g., '2025-10' for monthly
  currency: string;
  rolloverEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetSummary {
  budget: Budget;
  allocations: BudgetCategoryAllocation[];
  totalPlannedCents: number;
  totalSpentCents: number;
  totalRemainingCents: number;
  overspendCount: number;
}

export interface CreateBudgetInput {
  name: string;
  period: BudgetPeriod;
  periodValue: string;
  currency?: string;
  rolloverEnabled?: boolean;
  allocations: Array<{
    categoryId: string;
    plannedCents: number;
    rolloverFromPrevious?: boolean;
  }>;
}

export interface UpdateBudgetInput {
  name?: string;
  period?: BudgetPeriod;
  periodValue?: string;
  currency?: string;
  rolloverEnabled?: boolean;
  allocations?: Array<{
    categoryId: string;
    plannedCents: number;
    rolloverFromPrevious?: boolean;
  }>;
}

