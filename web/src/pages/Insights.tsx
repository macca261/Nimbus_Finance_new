import React, { useMemo } from 'react';
import { AppShell } from '../layout/AppShell';
import { useTransactionsData } from '../hooks/useTransactionsData';
import { calculateKpis } from '../lib/insights/kpis';
import { detectRecurringCandidates } from '../lib/insights/recurring';
import { findUnusualExpenses } from '../lib/insights/anomalies';
import { formatCurrency, formatDate, formatPercent } from '../lib/format';
import { getCategoryMeta } from '../lib/categories';
import { getTransactionDisplayName } from '../lib/transactions/displayName';
import { CategoryDonutChart } from '../components/insights/CategoryDonutChart';
import { KpiCard } from '../components/dashboard/KpiCard';

const SHELL_CLASS = 'mx-auto w-full max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12';

export const Insights: React.FC = () => {
  const { transactions, isLoading, error, currentPeriod, setCurrentPeriod } = useTransactionsData('90d');

  // Calculate KPIs
  const kpis = useMemo(() => calculateKpis(transactions), [transactions]);

  // Category aggregation for donut chart
  const categoryData = useMemo(() => {
    const expenses = transactions.filter(tx => tx.amount < 0);
    const byCategory = new Map<string, number>();

    for (const tx of expenses) {
      const categoryId = tx.categoryId ?? 'other';
      const current = byCategory.get(categoryId) ?? 0;
      byCategory.set(categoryId, current + Math.abs(tx.amount));
    }

    return Array.from(byCategory.entries())
      .map(([id, total]) => ({
        id,
        label: getCategoryMeta(id).label,
        total,
      }))
      .sort((a, b) => b.total - a.total);
  }, [transactions]);

  // Top category
  const topCategory = useMemo(() => {
    if (categoryData.length === 0) return null;
    const top = categoryData[0];
    const totalExpenses = kpis.totalExpenses;
    const share = totalExpenses > 0 ? top.total / totalExpenses : 0;
    return { ...top, share };
  }, [categoryData, kpis.totalExpenses]);

  // Largest single expense (from normalized transactions)
  const largestExpense = useMemo(() => {
    const expenses = transactions.filter(tx => tx.amount < 0);
    if (expenses.length === 0) return null;
    return expenses.reduce((max, tx) => (Math.abs(tx.amount) > Math.abs(max.amount) ? tx : max));
  }, [transactions]);

  // Recurring candidates
  const recurringCandidates = useMemo(() => detectRecurringCandidates(transactions), [transactions]);

  // Anomalies
  const anomalies = useMemo(() => findUnusualExpenses(transactions), [transactions]);

  const handlePeriodChange = (period: '30d' | '90d' | 'year') => {
    setCurrentPeriod(period);
  };

  const periodLabel =
    currentPeriod === '30d' ? '30 Tage' : currentPeriod === '90d' ? '90 Tage' : 'Dieses Jahr';

  return (
    <AppShell>
      <main className="flex-1 pb-10">
        <div className={SHELL_CLASS}>
          <div className="py-6">
            {/* Header */}
            <section className="mb-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h1 className="text-2xl font-semibold text-nf-text-main">Insights</h1>
                  <p className="text-sm text-nf-text-muted">
                    Dein Geld in Zahlen – verständlich und übersichtlich.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePeriodChange('30d')}
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition ${
                      currentPeriod === '30d'
                        ? 'border-nf-primary bg-nf-primary-soft text-nf-primary'
                        : 'border-nf-border-subtle bg-nf-bg-card text-nf-text-main shadow-xs hover:border-nf-primary hover:text-nf-primary'
                    }`}
                  >
                    30 Tage
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePeriodChange('90d')}
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition ${
                      currentPeriod === '90d'
                        ? 'border-nf-primary bg-nf-primary-soft text-nf-primary'
                        : 'border-nf-border-subtle bg-nf-bg-card text-nf-text-main shadow-xs hover:border-nf-primary hover:text-nf-primary'
                    }`}
                  >
                    90 Tage
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePeriodChange('year')}
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition ${
                      currentPeriod === 'year'
                        ? 'border-nf-primary bg-nf-primary-soft text-nf-primary'
                        : 'border-nf-border-subtle bg-nf-bg-card text-nf-text-main shadow-xs hover:border-nf-primary hover:text-nf-primary'
                    }`}
                  >
                    Dieses Jahr
                  </button>
                </div>
              </div>
            </section>

            {/* Error state */}
            {error && (
              <div className="mb-6 rounded-3xl border border-nf-negative/30 bg-nf-negative/10 px-4 py-3 text-sm text-nf-negative">
                {error}
              </div>
            )}

            {/* KPI Strip */}
            <section className="mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  label="Gesamtausgaben"
                  value={formatCurrency(kpis.totalExpenses)}
                  loading={isLoading}
                  icon="expense"
                />
                <KpiCard
                  label="Gesamteinnahmen"
                  value={formatCurrency(kpis.totalIncome)}
                  loading={isLoading}
                  icon="income"
                />
                <KpiCard
                  label="Netto"
                  value={formatCurrency(kpis.netto)}
                  isNegative={kpis.netto < 0}
                  loading={isLoading}
                  icon="wallet"
                />
                <KpiCard
                  label="Buchungen"
                  value={kpis.transactionCount.toLocaleString('de-DE')}
                  loading={isLoading}
                  icon="target"
                />
              </div>
            </section>

            {/* Donut + Wow Cards */}
            <section className="mb-6 grid gap-6 lg:grid-cols-12">
              {/* Donut Chart */}
              <div className="lg:col-span-7 rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-5 sm:p-6 lg:p-7 shadow-elevated transition-all duration-200 ease-out hover:-translate-y-[1px] hover:shadow-xl">
                <CategoryDonutChart data={categoryData} loading={isLoading} periodLabel={periodLabel} />
              </div>

              {/* Wow Cards */}
              <div className="lg:col-span-5 space-y-4">
                {/* Top Category */}
                {topCategory && (
                  <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-6 shadow-elevated transition-all duration-200 ease-out hover:-translate-y-[1px] hover:shadow-xl">
                    <h3 className="text-base font-semibold text-nf-text-main mb-3">Top-Kategorie</h3>
                    <p className="text-lg text-nf-text-main mb-2">
                      <span className="font-semibold">{formatCurrency(topCategory.total)}</span> für{' '}
                      <span className="font-semibold">{topCategory.label}</span>
                    </p>
                    <p className="text-sm text-nf-text-muted">
                      {formatPercent(topCategory.share)} deiner Ausgaben
                    </p>
                  </div>
                )}

                {/* Largest Expense */}
                {largestExpense && (
                  <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-6 shadow-elevated transition-all duration-200 ease-out hover:-translate-y-[1px] hover:shadow-xl">
                    <h3 className="text-base font-semibold text-nf-text-main mb-3">
                      Größte Ausgabe
                    </h3>
                    <p className="text-2xl font-semibold text-nf-text-main mb-2">
                      {formatCurrency(Math.abs(largestExpense.amount))}
                    </p>
                    <p className="text-sm font-medium text-nf-text-main mb-1 truncate" title={largestExpense.merchant}>
                      {largestExpense.merchant}
                    </p>
                    <p className="text-xs text-nf-text-muted mb-3">
                      {largestExpense.bookingDate ? formatDate(largestExpense.bookingDate) : '—'}
                    </p>
                    <p className="text-xs text-nf-text-muted">
                      Dein größter Einzelkauf in diesem Zeitraum.
                    </p>
                  </div>
                )}

                {/* Recurring Candidates */}
                <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-6 shadow-elevated transition-all duration-200 ease-out hover:-translate-y-[1px] hover:shadow-xl">
                  <h3 className="text-base font-semibold text-nf-text-main mb-4">Vermutlich Abo</h3>
                  {recurringCandidates.length > 0 ? (
                    <div className="space-y-4">
                      {recurringCandidates.map((candidate, idx) => {
                        const nextDate = new Date(candidate.lastDate);
                        nextDate.setDate(nextDate.getDate() + candidate.medianIntervalDays);
                        return (
                          <div key={idx} className="border-t border-nf-border-subtle pt-4 first:border-t-0 first:pt-0">
                            <p className="text-sm font-medium text-nf-text-main mb-1.5 truncate" title={candidate.merchant}>
                              {candidate.merchant}
                            </p>
                            <p className="text-xs text-nf-text-muted mb-1">
                              ~{formatCurrency(candidate.typicalAmount)} / Monat
                            </p>
                            <p className="text-xs text-nf-text-soft">
                              Nächstes Mal: {formatDate(nextDate.toISOString())}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-nf-text-muted">
                      Keine Abos gefunden.
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Anomalies */}
            <section>
              <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-6 lg:p-7 shadow-elevated transition-all duration-200 ease-out hover:-translate-y-[1px] hover:shadow-xl">
                <h3 className="text-lg font-semibold text-nf-text-main mb-5">
                  Ungewöhnliche Ausgaben
                </h3>
                {anomalies.length > 0 ? (
                  <div className="space-y-3">
                    {anomalies.map((anomaly, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-4 rounded-xl border border-nf-border-subtle bg-nf-bg-card-subtle px-4 py-3.5 transition hover:bg-nf-bg-card"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1.5">
                            <span className="text-sm font-medium text-nf-text-main truncate" title={getTransactionDisplayName(anomaly.tx)}>
                              {getTransactionDisplayName(anomaly.tx)}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-nf-warning/10 px-2 py-0.5 text-[10px] font-medium text-nf-warning shrink-0">
                              Ausreißer
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-nf-text-muted">
                            <span>{anomaly.tx.bookingDate ? formatDate(anomaly.tx.bookingDate) : '—'}</span>
                            <span>·</span>
                            <span>{anomaly.categoryLabel}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-semibold text-nf-negative tabular-nums">
                            {formatCurrency(Math.abs(anomaly.tx.amount))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-nf-text-muted">
                    Keine Ausreißer – alles im Rahmen ✨
                  </p>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </AppShell>
  );
};

export default Insights;

