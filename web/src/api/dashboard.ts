export type CategoryId =
  | 'income_salary'
  | 'income_other'
  | 'housing_rent'
  | 'housing_utilities'
  | 'groceries'
  | 'dining_out'
  | 'shopping'
  | 'subscriptions'
  | 'transport'
  | 'travel'
  | 'health'
  | 'insurance'
  | 'education'
  | 'kids'
  | 'household'
  | 'fees_charges'
  | 'cash_withdrawal'
  | 'savings_investment'
  | 'taxes'
  | 'transfer_internal'
  | 'transfer_external'
  | 'unknown';

export interface DashboardSummary {
  lastImport?: {
    profileId: string;
    fileName: string;
    importedAt: string;
    confidence: number;
    transactionCount: number;
  };
  kpis: {
    currentBalance: number;
    income30d: number;
    expenses30d: number;
    net30d: number;
  };
  spendingByCategory: Array<{ category: CategoryId; label: string; amount: number; share: number }>;
  balanceOverTime: Array<{ date: string; balance: number }>;
  cashflowByMonth: Array<{ month: string; income: number; expenses: number }>;
  subscriptions: Array<{
    merchant: string;
    amount: number;
    category: CategoryId;
    lastDate: string;
    intervalGuess: 'monthly' | 'weekly' | 'yearly' | 'unknown';
  }>;
  achievements: Array<{ id: string; title: string; description: string; achieved: boolean }>;
  recentTransactions: Array<{
    id: number;
    bookedAt: string | null;
    counterpart: string | null;
    purpose: string | null;
    amount: number;
    currency: string;
    category: CategoryId;
    categorySource: string | null;
    categoryConfidence: number | null;
    categoryExplanation: string | null;
  }>;
  transactionCount: number;
  parserWarnings: string[];
  accounts?: Array<{
    id?: string;
    accountId?: string;
    label?: string;
    name?: string;
    type?: 'bank' | 'paypal' | 'other';
    balance?: number;
  }>;
  importHistory?: Array<{
    id?: string;
    profileId: string;
    fileName?: string;
    importedAt: string;
    transactionCount?: number;
    confidence?: number;
    warnings?: string[];
    status?: 'success' | 'warning' | 'error';
  }>;
}

export async function fetchDashboardSummary(signal?: AbortSignal): Promise<DashboardSummary> {
  const res = await fetch('/api/dashboard', { signal });
  if (!res.ok) {
    throw new Error('Dashboard summary could not be loaded');
  }
  return (await res.json()) as DashboardSummary;
}


