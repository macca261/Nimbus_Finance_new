export type GoalType = 'savings' | 'debt' | 'net_worth';

export type GoalStatus = 'on_track' | 'behind' | 'ahead' | 'completed' | 'no_target';

export interface Goal {
  id: string;
  name: string;
  type: GoalType;
  targetCents: number;
  currentCents: number;
  targetDate: string | null;
  currency: string;
  linkedAccountIds: string[] | null;
  linkedCategoryIds: string[] | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GoalProgress {
  goal: Goal;
  currentCents: number;
  targetCents: number;
  progressPercent: number;
  remainingCents: number;
  requiredMonthlyCents: number | null;
  projectedCompletionDate: string | null;
  status: GoalStatus;
}

export interface CreateGoalInput {
  name: string;
  type: GoalType;
  targetCents: number;
  currentCents?: number;
  targetDate?: string | null;
  currency?: string;
  linkedAccountIds?: string[] | null;
  linkedCategoryIds?: string[] | null;
  description?: string | null;
  isActive?: boolean;
}

export interface UpdateGoalInput {
  name?: string;
  type?: GoalType;
  targetCents?: number;
  currentCents?: number;
  targetDate?: string | null;
  currency?: string;
  linkedAccountIds?: string[] | null;
  linkedCategoryIds?: string[] | null;
  description?: string | null;
  isActive?: boolean;
}

