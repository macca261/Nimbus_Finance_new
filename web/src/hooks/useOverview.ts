import { useEffect, useState } from 'react';

type Summary = {
  balance: number;
  income6m: { month: string; amount: number }[];
  expense6m: { month: string; amount: number }[];
  categories: { name: string; value: number }[];
  recent: { id: string; merchant: string; date: string; amount: number }[];
};

const MOCK: Summary = {
  balance: -845.4,
  income6m: [
    { month: 'Jan', amount: 2450 },
    { month: 'Feb', amount: 2320 },
    { month: 'Mar', amount: 2500 },
    { month: 'Apr', amount: 2350 },
    { month: 'May', amount: 2600 },
    { month: 'Jun', amount: 2710 },
  ],
  expense6m: [
    { month: 'Jan', amount: 1450 },
    { month: 'Feb', amount: 1680 },
    { month: 'Mar', amount: 1500 },
    { month: 'Apr', amount: 1620 },
    { month: 'May', amount: 1700 },
    { month: 'Jun', amount: 1810 },
  ],
  categories: [
    { name: 'Rent', value: 620 },
    { name: 'Groceries', value: 180 },
    { name: 'Transport', value: 95 },
    { name: 'Utilities', value: 70 },
    { name: 'Dining', value: 52 },
  ],
  recent: [
    { id: '1', merchant: 'Spotify', date: new Date().toISOString(), amount: -9.99 },
    { id: '2', merchant: 'Lidl', date: new Date().toISOString(), amount: -35.47 },
    { id: '3', merchant: 'Salary', date: new Date().toISOString(), amount: 2450 },
  ],
};

export function useOverview() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Try to fetch from /api/summary
        const [balanceRes, monthlyRes, transactionsRes] = await Promise.allSettled([
          fetch('/api/summary/balance').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/summary/monthly?months=6').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/transactions?limit=10').then((r) => (r.ok ? r.json() : null)),
        ]);

        let balance = MOCK.balance;
        let income6m = MOCK.income6m;
        let expense6m = MOCK.expense6m;
        let categories = MOCK.categories;
        let recent = MOCK.recent;

        // Process balance
        if (balanceRes.status === 'fulfilled' && balanceRes.value?.data) {
          balance = balanceRes.value.data.balanceCents / 100;
        }

        // Process monthly data
        if (monthlyRes.status === 'fulfilled' && monthlyRes.value?.data) {
          const monthly = monthlyRes.value.data;
          income6m = monthly.map((m: any) => ({
            month: new Date(m.month).toLocaleDateString('en-US', { month: 'short' }),
            amount: m.incomeCents / 100,
          }));
          expense6m = monthly.map((m: any) => ({
            month: new Date(m.month).toLocaleDateString('en-US', { month: 'short' }),
            amount: m.expenseCents / 100,
          }));
        }

        // Process categories from transactions
        if (transactionsRes.status === 'fulfilled' && transactionsRes.value?.data) {
          const txs = transactionsRes.value.data;
          const catMap = new Map<string, number>();
          txs.forEach((tx: any) => {
            if (tx.amountCents < 0 && tx.category) {
              const cat = tx.category;
              catMap.set(cat, (catMap.get(cat) || 0) + Math.abs(tx.amountCents) / 100);
            }
          });
          categories = Array.from(catMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

          // Build recent activity
          recent = txs.slice(0, 10).map((tx: any) => ({
            id: String(tx.id),
            merchant: tx.purpose || tx.description || 'Transaction',
            date: tx.bookingDate || new Date().toISOString(),
            amount: tx.amountCents / 100,
          }));
        }

        setData({ balance, income6m, expense6m, categories, recent });
      } catch {
        setData(MOCK);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { data, loading };
}

