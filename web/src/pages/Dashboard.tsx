import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../layout/AppShell';
import { useDashboardState } from '../hooks/useDashboardState';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { DashboardKpiRow } from '../components/dashboard/DashboardKpiRow';
import { DashboardBalanceChart } from '../components/dashboard/DashboardBalanceChart';
import { DashboardCategoryPanel } from '../components/dashboard/DashboardCategoryPanel';
import { DashboardTiles } from '../components/dashboard/DashboardTiles';
import { DashboardEmptyState } from '../components/dashboard/DashboardEmptyState';
import { RecentActivityMini } from '../components/dashboard/RecentActivityMini';
import { formatCurrency, formatPercent } from '../lib/format';
import { EngagementStrip } from '../components/dashboard/EngagementStrip';
import { InsightsRow } from '../components/dashboard/InsightsRow';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const dashboard = useDashboardState();
  const summary = dashboard.summary;

  const headerSubtitle = useMemo(() => {
    const accountLabel =
      dashboard.accountsCount === 1
        ? '1 Konto'
        : `${dashboard.accountsCount.toLocaleString('de-DE')} Konten`;
    const paypalLabel =
      dashboard.paypalWalletsCount === 1
        ? '1 PayPal Wallet'
        : `${dashboard.paypalWalletsCount.toLocaleString('de-DE')} PayPal Wallets`;
    return `Stand: ${dashboard.selectedPeriodOption.label} · ${accountLabel} · ${paypalLabel}`;
  }, [dashboard.accountsCount, dashboard.paypalWalletsCount, dashboard.selectedPeriodOption.label]);

  const kpiData = useMemo(() => {
    const income = summary?.kpis.income30d ?? 0;
    const expenses = summary?.kpis.expenses30d ?? 0;
    const balance = summary?.kpis.currentBalance ?? 0;
    const savingsRate = income > 0 ? Math.max(0, Math.min(1, (income - expenses) / income)) : 0;

    const totalExpenses = (summary?.spendingByCategory ?? []).reduce(
      (sum, cat) => sum + (cat.amount ?? 0),
      0,
    );
    const fixedAmount = (summary?.spendingByCategory ?? [])
      .filter(cat => ['subscriptions', 'fees_charges', 'housing:rent', 'housing:utilities'].includes(cat.category))
      .reduce((sum, cat) => sum + (cat.amount ?? 0), 0);
    const fixedShare = totalExpenses > 0 ? fixedAmount / totalExpenses : 0;

    return [
      {
        id: 'balance',
        label: 'Aktueller Kontostand',
        value: formatCurrency(balance),
        hint: 'Inkl. aller importierten Buchungen',
      },
      {
        id: 'income',
        label: `Einnahmen (${dashboard.selectedPeriodOption.label})`,
        value: formatCurrency(income),
      },
      {
        id: 'expenses',
        label: `Ausgaben (${dashboard.selectedPeriodOption.label})`,
        value: formatCurrency(expenses),
      },
      {
        id: 'savings',
        label: 'Sparquote',
        value: formatPercent(savingsRate),
        hint:
          income > 0
            ? `Ø ${(income - expenses > 0 ? formatCurrency(income - expenses) : formatCurrency(0))} zurückgelegt`
            : 'Noch nicht genügend Daten',
      },
      {
        id: 'fixed',
        label: 'Fixkosten-Anteil',
        value: formatPercent(fixedShare),
        hint: `${formatCurrency(fixedAmount)} deiner Ausgaben sind wiederkehrend.`,
      },
    ];
  }, [summary, dashboard.selectedPeriodOption.label]);

  const categorySlices = useMemo(
    () =>
      (summary?.spendingByCategory ?? []).map(item => ({
        id: item.category,
        label: item.label || item.category,
        total: item.amount,
      })),
    [summary?.spendingByCategory],
  );

  const insights = useMemo(() => {
    if (!summary?.spendingByCategory?.length) return [];
    const sorted = [...summary.spendingByCategory].sort((a, b) => b.amount - a.amount);
    const top = sorted[0];
    if (!top || top.amount <= 0) return [];
    const total = sorted.reduce((sum, item) => sum + item.amount, 0);
    const share = total > 0 ? top.amount / total : 0;
    return [
      {
        title: `Top-Kategorie: ${top.label ?? top.category}`,
        description: `${formatCurrency(top.amount)} · ${formatPercent(share)} deiner Ausgaben im aktuellen Zeitraum.`,
      },
    ];
  }, [summary?.spendingByCategory]);

  const reviewCounts = useMemo(() => {
    const lowConfidence = dashboard.recent.filter(tx => (tx.categoryConfidence ?? 1) < 0.5).length;
    return {
      uncategorized: summary?.uncategorizedCount ?? 0,
      lowConfidence,
    };
  }, [dashboard.recent, summary?.uncategorizedCount]);

  if (dashboard.uiState === 'empty') {
    return (
      <AppShell>
        <div className="flex flex-col gap-8">
          <DashboardEmptyState
            onImported={dashboard.refetch}
            onNavigateToImports={() => navigate('/imports')}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <DashboardHeader
          userName={null}
          subtitle={headerSubtitle}
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
        />

        {dashboard.error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            {dashboard.error}
          </div>
        ) : null}

        {dashboard.uiState === 'early' ? (
          <div className="rounded-3xl border border-indigo-200 bg-indigo-50 px-5 py-4 text-xs text-indigo-700 shadow-sm dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200">
            Importiere weitere Konten, um ein vollständiges Bild zu erhalten. Jede CSV verbessert deine Analysen.
          </div>
        ) : null}

        <DashboardKpiRow kpis={kpiData} loading={dashboard.loading} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <DashboardBalanceChart
            balance={summary?.balanceOverTime ?? []}
            cashflow={summary?.cashflowByMonth ?? []}
            loading={dashboard.loading}
          />
          <DashboardCategoryPanel data={categorySlices} loading={dashboard.loading} />
        </div>

        <DashboardTiles
          subscriptions={summary?.subscriptions ?? []}
          review={reviewCounts}
          dataQuality={{
            lastImport: summary?.lastImport,
            warningsCount: dashboard.warningsCount,
            importsCount: dashboard.importsCount,
          }}
          insights={insights}
          onOpenSubscriptions={() => navigate('/transactions')}
          onOpenReview={() => navigate('/transactions')}
          onOpenImports={() => navigate('/imports')}
        />

        <InsightsRow
          subscriptions={summary?.subscriptions ?? []}
          taxHints={summary?.potentialTaxRelevant ?? []}
          cashflowByMonth={summary?.cashflowByMonth ?? []}
          uncategorizedCount={summary?.uncategorizedCount ?? 0}
        />

        <EngagementStrip
          achievements={dashboard.achievements}
          subscriptions={summary?.subscriptions ?? []}
          cashflowByMonth={summary?.cashflowByMonth ?? []}
          currentBalance={summary?.kpis.currentBalance ?? 0}
        />

        <RecentActivityMini transactions={dashboard.recent} loading={dashboard.loading && !dashboard.recent.length} />
      </div>
    </AppShell>
  );
};

export default Dashboard;

