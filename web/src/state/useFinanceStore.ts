import { create } from 'zustand';

export type Transaction = {
  id?: number;
  bookedAt: string;
  valueDate?: string;
  amount: number;
  currency: string;
  counterpart?: string;
  purpose?: string;
  iban?: string;
  bic?: string;
  balanceAfter?: number | null;
  category?: string;
  categorySource?: string;
  categoryConfidence?: number;
  categoryExplanation?: string;
};

export type Kpis = {
  balance: number;
  income30d: number;
  expenses30d: number;
  savingsRate: number;
};

export type ChartData = {
  balanceHistory: { date: string; balance: number }[];
  byCategory: { category: string; total: number }[];
  cashflow: { month: string; income: number; expenses: number }[];
};

type FinanceState = {
  loading: boolean;
  error: string | null;
  transactions: Transaction[];
  kpis: Kpis;
  charts: ChartData;
  lastImport?: {
    profileId: string;
    inserted: number;
    timestamp: string;
  };
  setError: (msg: string | null) => void;
  loadRecent: () => Promise<void>;
  applyImportResult: (params: { profileId: string; inserted: number }) => Promise<void>;
  setFromTransactions: (txs: Transaction[]) => void;
};

function deriveKpis(transactions: Transaction[]): Kpis {
  if (!transactions.length) {
    return { balance: 0, income30d: 0, expenses30d: 0, savingsRate: 0 };
  }
  const now = new Date();
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  let income30d = 0;
  let expenses30d = 0;
  let latestBalance = 0;
  for (const t of transactions) {
    const d = new Date(t.bookedAt);
    if (!Number.isNaN(d.getTime()) && d >= cutoff) {
      if (t.amount > 0) income30d += t.amount;
      if (t.amount < 0) expenses30d += Math.abs(t.amount);
    }
    if (t.balanceAfter != null) {
      latestBalance = t.balanceAfter;
    }
  }

  const balance = latestBalance || transactions.reduce((sum, t) => sum + t.amount, 0);
  const savingsRate = income30d > 0 ? Math.max(0, Math.min(1, (income30d - expenses30d) / income30d)) : 0;

  return { balance, income30d, expenses30d, savingsRate };
}

function deriveCharts(transactions: Transaction[]): ChartData {
  const byDate = new Map<string, number>();
  const byCat = new Map<string, number>();
  const byMonth = new Map<string, { income: number; expenses: number }>();

  let running = 0;
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.bookedAt).getTime() - new Date(b.bookedAt).getTime(),
  );

  for (const t of sorted) {
    const day = t.bookedAt.slice(0, 10);
    running += t.amount;
    byDate.set(day, running);

    const cat = t.category || 'Unklassifiziert';
    byCat.set(cat, (byCat.get(cat) || 0) + Math.abs(t.amount));

    const month = t.bookedAt.slice(0, 7);
    const entry = byMonth.get(month) || { income: 0, expenses: 0 };
    if (t.amount > 0) entry.income += t.amount;
    else entry.expenses += Math.abs(t.amount);
    byMonth.set(month, entry);
  }

  return {
    balanceHistory: Array.from(byDate.entries()).map(([date, balance]) => ({ date, balance })),
    byCategory: Array.from(byCat.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total),
    cashflow: Array.from(byMonth.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([month, { income, expenses }]) => ({ month, income, expenses })),
  };
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  loading: false,
  error: null,
  transactions: [],
  kpis: { balance: 0, income30d: 0, expenses30d: 0, savingsRate: 0 },
  charts: { balanceHistory: [], byCategory: [], cashflow: [] },
  lastImport: undefined,

  setError: msg => set({ error: msg }),

  setFromTransactions: transactions => {
    const kpis = deriveKpis(transactions);
    const charts = deriveCharts(transactions);
    set({ transactions, kpis, charts, loading: false, error: null });
  },

  loadRecent: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/transactions/recent');
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to load transactions');
      }
      const json = await res.json();
      get().setFromTransactions(json.transactions || []);
    } catch (e: any) {
      console.error(e);
      set({ error: e.message || 'Fehler beim Laden der Transaktionen', loading: false });
    }
  },

  applyImportResult: async ({ profileId, inserted }) => {
    set({
      lastImport: {
        profileId,
        inserted,
        timestamp: new Date().toISOString(),
      },
    });
    await get().loadRecent();
  },
}));

