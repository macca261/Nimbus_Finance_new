import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../layout/AppShell';
import { useDashboardState } from '../hooks/useDashboardState';
import { DashboardHeaderCompact } from '../components/dashboard/DashboardHeaderCompact';
import { KpiCard } from '../components/dashboard/KpiCard';
import { DashboardBalanceChart } from '../components/dashboard/DashboardBalanceChart';
import { CategoryDonutWithNavigation } from '../components/dashboard/CategoryDonutWithNavigation';
import { DashboardEmptyState } from '../components/dashboard/DashboardEmptyState';
import { RecentActivityMini } from '../components/dashboard/RecentActivityMini';
import { formatCurrency, formatPercent, formatDate } from '../lib/format';
import { GoalsSection } from '../components/dashboard/GoalsSection';
import { AttentionCards } from '../components/dashboard/AttentionCards';
import { ResetDbCard } from '../components/dashboard/ResetDbCard';
import { classnames } from '../ui/tokens';
import { ManageImportsDialog } from '../components/admin/ManageImportsDialog';
import { fetchReviewTransactions } from '../api/reviewApi';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const dashboard = useDashboardState();
  const summary = dashboard.summary;
  const [manageImportsOpen, setManageImportsOpen] = useState(false);
  const [reviewCounts, setReviewCounts] = useState({
    uncategorized: 0,
    lowConfidence: 0,
  });
  const [reviewLoading, setReviewLoading] = useState(false);

  // Build last import info for header
  const lastImportInfo = useMemo(() => {
    if (!summary?.lastImport) return null;
    const bankName = summary.lastImport.profileId || 'Unbekannt';
    const count = summary.lastImport.transactionCount ?? 0;
    const date = formatDate(summary.lastImport.importedAt);
    return `Letzter Import: ${bankName} · ${count.toLocaleString('de-DE')} Buchungen · ${date}`;
  }, [summary?.lastImport]);

  // Navigation helper for Transactions page
  const navigateToTransactions = useCallback(
    (params: Record<string, string>) => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value) searchParams.set(key, value);
      });
      navigate(`/transactions?${searchParams.toString()}`);
    },
    [navigate],
  );

  // Get latest transaction date for balance hint
  const latestTransactionDate = useMemo(() => {
    if (!summary?.balanceOverTime?.length) return null;
    const latest = summary.balanceOverTime[summary.balanceOverTime.length - 1];
    return latest?.date ? formatDate(latest.date) : null;
  }, [summary?.balanceOverTime]);

  const categorySlices = useMemo(
    () =>
      (summary?.spendingByCategory ?? []).map(item => ({
        id: item.category,
        label: item.label || item.category,
        total: item.amount,
      })),
    [summary?.spendingByCategory],
  );

  // Fetch review counts from the review API
  useEffect(() => {
    let cancelled = false;

    async function loadReview() {
      try {
        setReviewLoading(true);
        const items = await fetchReviewTransactions();
        if (cancelled) return;

        const uncategorized = items.filter(tx => !tx.category || tx.category === 'other').length;
        const lowConfidence = items.filter(tx => (tx.categoryConfidence ?? 0) < 0.4).length;

        setReviewCounts({ uncategorized, lowConfidence });
      } catch (err) {
        // Silently fail - review counts are not critical for dashboard
        console.error('[Dashboard] Failed to load review counts', err);
      } finally {
        if (!cancelled) {
          setReviewLoading(false);
        }
      }
    }

    loadReview();
    return () => {
      cancelled = true;
    };
  }, []);

  if (dashboard.uiState === 'empty') {
    return (
      <AppShell>
        <div className={classnames.sectionGap}>
          <DashboardEmptyState
            onImported={dashboard.refetch}
            onNavigateToImports={() => navigate('/imports')}
          />
        </div>
      </AppShell>
    );
  }

  const income = summary?.kpis.income30d ?? 0;
  const expenses = summary?.kpis.expenses30d ?? 0;
  const balance = summary?.kpis.currentBalance ?? 0;
  const savingsRate = income > 0 ? Math.max(0, Math.min(1, (income - expenses) / income)) : 0;
  const balanceHint = latestTransactionDate
    ? `Inklusive aller importierten Konten · Stand: ${latestTransactionDate}`
    : 'Inklusive aller importierten Konten';

  return (
    <AppShell>
      <div className="space-y-6 md:space-y-8">
        {/* Row 0: Header / Filters */}
        <section>
          <DashboardHeaderCompact
            userName={null}
            accounts={dashboard.accounts}
            selectedAccount={dashboard.selectedAccount}
            onSelectAccount={dashboard.setSelectedAccount}
            periodOptions={dashboard.periodOptions}
            selectedPeriod={dashboard.selectedPeriodOption}
            onSelectPeriod={dashboard.setSelectedPeriod}
            hasWarnings={dashboard.hasParserWarnings}
            warningsCount={dashboard.warningsCount}
            onWarningsClick={() => navigate('/imports')}
            onUploadClick={() => navigate('/imports')}
            lastImportInfo={lastImportInfo}
          />
        </section>

        {/* Error / Early state messages */}
        {dashboard.error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            {dashboard.error}
          </div>
        ) : null}

        {dashboard.uiState === 'early' ? (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200">
            Importiere weitere Konten, um ein vollständiges Bild zu erhalten. Jede CSV verbessert deine Analysen.
          </div>
        ) : null}

        {/* Row 1: KPI Cards */}
        <section className="grid gap-6 md:grid-cols-12">
          <div className="md:col-span-3">
            <KpiCard
              label="Kontostand (alle Konten)"
              value={formatCurrency(balance)}
              hint={balanceHint}
              isNegative={balance < 0}
              loading={dashboard.loading}
            />
          </div>
          <div className="md:col-span-3">
            <KpiCard
              label={`Einnahmen – ${dashboard.selectedPeriodOption.label}`}
              value={formatCurrency(income)}
              loading={dashboard.loading}
            />
          </div>
          <div className="md:col-span-3">
            <KpiCard
              label={`Ausgaben – ${dashboard.selectedPeriodOption.label}`}
              value={formatCurrency(expenses)}
              isNegative={expenses < 0}
              loading={dashboard.loading}
            />
          </div>
          <div className="md:col-span-3">
            <KpiCard
              label="Sparquote"
              value={formatPercent(savingsRate)}
              hint={
                income > 0
                  ? `Ø ${income - expenses > 0 ? formatCurrency(income - expenses) : formatCurrency(0)} zurückgelegt`
                  : 'Noch nicht genügend Daten'
              }
              loading={dashboard.loading}
            />
          </div>
        </section>

        {/* Row 2: Charts */}
        <section className="grid gap-6 md:grid-cols-12">
          <div className="md:col-span-8">
            <DashboardBalanceChart
              balance={summary?.balanceOverTime ?? []}
              cashflow={summary?.cashflowByMonth ?? []}
              loading={dashboard.loading}
            />
          </div>
          <div className="md:col-span-4">
            <CategoryDonutWithNavigation
              data={categorySlices}
              loading={dashboard.loading}
              dateRangeLabel={dashboard.selectedPeriodOption.label}
              onCategoryClick={categoryId => navigateToTransactions({ category: categoryId })}
            />
          </div>
        </section>

        {/* Row 3: Attention & Actions */}
        <section>
          <AttentionCards
            reviewCounts={reviewCounts}
            reviewLoading={reviewLoading}
            spendingByCategory={summary?.spendingByCategory ?? []}
            dateRangeLabel={dashboard.selectedPeriodOption.label}
            onNavigateToTransactions={navigateToTransactions}
          />
        </section>

        {/* Row 4: Goals & Activity */}
        <section className="grid gap-6 md:grid-cols-12">
          <div className="md:col-span-6">
            <GoalsSection
              currentBalance={summary?.kpis.currentBalance ?? 0}
              achievements={dashboard.achievements}
              cashflowByMonth={summary?.cashflowByMonth ?? []}
            />
          </div>
          <div className="md:col-span-6">
            <RecentActivityMini
              transactions={dashboard.recent}
              loading={dashboard.loading && !dashboard.recent.length}
            />
          </div>
        </section>

        {/* Admin controls - only in dev, at bottom */}
        {import.meta.env.DEV && (
          <section>
            <ResetDbCard onReset={dashboard.refetch} onManageImports={() => setManageImportsOpen(true)} />
          </section>
        )}
      </div>
      <ManageImportsDialog
        open={manageImportsOpen}
        onClose={() => setManageImportsOpen(false)}
        onDeleted={dashboard.refetch}
      />
    </AppShell>
  );
};

export default Dashboard;

