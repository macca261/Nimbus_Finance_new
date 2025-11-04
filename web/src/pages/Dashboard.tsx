import { useEffect, useState } from 'react';
import { getBalance, getMonthly, getCategories, getTransactions } from '../lib/api';
import { formatEuro } from '../lib/format';
import KpiCard from '../components/dashboard/KpiCard';
import Section from '../components/dashboard/Section';
import TransactionsTable from '../components/dashboard/TransactionsTable';
import UploadCta from '../components/dashboard/UploadCta';
import MonthlyAreaChart from '../components/dashboard/MonthlyAreaChart';

type MonthlyData = { month: string; incomeCents: number; expenseCents: number };
type CategoryData = { category: string; amountCents: number };
type TransactionRow = { id?: string | number; bookingDate: string; purpose: string; amountCents: number; category?: string };

export default function Dashboard() {
  const [balance, setBalance] = useState<{ balanceCents: number; currency: string } | null>(null);
  const [monthly, setMonthly] = useState<MonthlyData[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('Gerade eben');

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [balanceRes, monthlyRes, categoriesRes, transactionsRes] = await Promise.all([
          getBalance().catch(() => ({ data: { balanceCents: 0, currency: 'EUR' } })),
          getMonthly().catch(() => ({ data: [] })),
          getCategories().catch(() => ({ data: [] })),
          getTransactions(10).catch(() => ({ data: [] })),
        ]);

        if (cancelled) return;

        // Normalize to safe shapes
        setBalance(balanceRes?.data || null);
        setMonthly(Array.isArray(monthlyRes?.data) ? monthlyRes.data : []);
        setCategories(Array.isArray(categoriesRes?.data) ? categoriesRes.data : []);
        setTransactions(Array.isArray(transactionsRes?.data) ? transactionsRes.data.map((tx: any) => ({
          id: tx.id,
          bookingDate: tx.bookingDate || '',
          purpose: tx.purpose || '',
          amountCents: tx.amountCents || 0,
          category: tx.category || undefined,
        })) : []);
        setLastUpdate(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
      } catch (err) {
        if (!cancelled) {
          setError('Daten konnten nicht geladen werden.');
          console.error('[dashboard] load error:', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();

    const onUpdate = () => loadData();
    window.addEventListener('nimbus:data-updated', onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener('nimbus:data-updated', onUpdate);
    };
  }, []);

  // Calculate KPIs
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthData = monthly.find(m => m.month === currentMonth) || { incomeCents: 0, expenseCents: 0 };
  const totalIncome = currentMonthData.incomeCents;
  const totalExpenses = Math.abs(currentMonthData.expenseCents);

  // Top categories (expenses only, sorted by absolute amount)
  const topCategories = categories
    .filter(c => c.amountCents < 0 && c.category && c.category !== 'Income')
    .map(c => ({ ...c, amountCents: Math.abs(c.amountCents) }))
    .sort((a, b) => b.amountCents - a.amountCents)
    .slice(0, 5);

  const maxCategoryAmount = Math.max(...topCategories.map(c => c.amountCents), 1);

  if (error && !loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 dark:bg-zinc-900/40 dark:border-zinc-800/50 shadow-sm p-6 text-center">
          <p className="text-slate-900 dark:text-slate-100 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-slate-100 leading-tight">
            Übersicht
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Dein finanzieller Überblick</p>
        </div>
        <UploadCta />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <KpiCard
          label="Saldo"
          value={balance ? formatEuro(balance.balanceCents) : '—'}
          loading={loading}
        />
        <KpiCard
          label="Einnahmen"
          value={formatEuro(totalIncome)}
          hint="Dieser Monat"
          loading={loading}
        />
        <KpiCard
          label="Ausgaben"
          value={totalExpenses > 0 ? `– ${formatEuro(totalExpenses)}` : formatEuro(0)}
          hint="Dieser Monat"
          loading={loading}
        />
        <KpiCard
          label="Letzte Aktualisierung"
          value={lastUpdate}
          loading={loading}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Area Chart */}
        <Section title="Monatsverlauf" subtitle="Einnahmen vs. Ausgaben" loading={loading}>
          <MonthlyAreaChart series={monthly} />
        </Section>

        {/* Top Categories */}
        <Section title="Top-Kategorien" subtitle="Ausgaben nach Kategorie" loading={loading}>
          {topCategories.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <p>Keine Kategoriedaten verfügbar</p>
            </div>
          ) : (
            <div className="space-y-4">
              {topCategories.map((cat, i) => (
                <div key={cat.category || i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {cat.category}
                    </span>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                      {formatEuro(cat.amountCents)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all"
                      style={{ width: `${(cat.amountCents / maxCategoryAmount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Transactions Table */}
      <Section title="Letzte Buchungen" subtitle="Die letzten 10 Transaktionen" loading={loading}>
        <TransactionsTable rows={transactions} loading={loading} />
      </Section>
    </div>
  );
}
