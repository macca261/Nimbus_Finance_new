import { useCallback, useEffect, useState } from 'react';

export type SpendingCategory = { category: string; label: string; amount: number; share: number };

export type DashboardSummary = {
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
  spendingByCategory: Array<{ category: string; label: string; amount: number; share: number }>;
  balanceOverTime: Array<{ date: string; balance: number }>;
  cashflowByMonth: Array<{ month: string; income: number; expenses: number }>;
  topCategories: SpendingCategory[];
  subscriptions: DashboardSubscription[];
  potentialTaxRelevant: TaxHint[];
  parserWarnings?: string[];
  uncategorizedCount?: number;
  transactionCount?: number;
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
};

export type Achievement = { id: string; title: string; description: string; achieved: boolean };
export type TxMini = {
  id?: number;
  bookingDate: string | null;
  valueDate?: string | null;
  payee?: string | null;
  purpose?: string | null;
  memo?: string | null;
  counterpart?: string | null;
  amount: number;
  currency: string;
  category?: string | null;
  isInternalTransfer?: boolean;
  transferLinkId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type DashboardSubscription = {
  merchant: string;
  category: string;
  averageAmount: number;
  occurrences: number;
  intervalGuess: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'unknown';
  lastDate: string;
  nextDate?: string;
};

export type TaxHint = { category: string; label: string; amount: number; hint: string };

export function useDashboardData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [recent, setRecent] = useState<TxMini[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sRes, aRes, tRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/achievements'),
        fetch('/api/transactions/recent?limit=5'),
      ]);
      if (!sRes.ok) throw new Error('Dashboard failed');
      const summaryJson = await sRes.json();
      const achJson = aRes.ok ? await aRes.json() : { achievements: [] };
      const txJson = tRes.ok ? await tRes.json() : { transactions: [] };

      setSummary(summaryJson as DashboardSummary);
      setAchievements((achJson?.achievements as Achievement[]) || []);
      const txMini = ((txJson?.transactions as TxMini[]) || []).map(tx => ({
        ...tx,
        bookingDate: tx.bookingDate ?? (tx as any).bookedAt ?? null,
      }));
      setRecent(txMini);
    } catch (e: any) {
      setError(e?.message || 'Dashboard-Daten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return {
    loading,
    error,
    summary,
    achievements,
    recent,
    refetch: fetchAll,
  };
}


