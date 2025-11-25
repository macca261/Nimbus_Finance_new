import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../layout/AppShell';
import { useDashboardState } from '../hooks/useDashboardState';
import { DashboardChartsHub } from '../components/dashboard/DashboardChartsHub';
import { DashboardEmptyState } from '../components/dashboard/DashboardEmptyState';
import { formatCurrency, formatPercent } from '../lib/format';
import { useMonthlyInsights } from '../lib/hooks/useMonthlyInsights';
import { ManageImportsDialog } from '../components/admin/ManageImportsDialog';
import { fetchReviewTransactions } from '../api/reviewApi';
import { DashboardCockpit } from '../components/dashboard/DashboardCockpit';
import { MonthlySnapshotCard } from '../components/dashboard/MonthlySnapshotCard';
import { WalletOverview } from '../components/wallet/WalletOverview';
import { AchievementsTeaser } from '../features/achievements/components/AchievementsTeaser';
import { CoachStoryCard } from '../features/coach/components/CoachStoryCard';
import { useCoachStory } from '../hooks/useCoachStory';
import { MonthGlanceCard } from '../features/dashboard/components/MonthGlanceCard';
import { useMonthSummary, type MonthSummary } from '../hooks/useMonthSummary';
import { QuestStrip } from '../features/quests/QuestStrip';
import { useQuests } from '../hooks/useQuests';
import { useGamificationData } from '../hooks/useGamificationData';
import { GamificationHud } from '../features/gamification/components/GamificationHud';
import { subscribeToDataMutations } from '../lib/dataEvents';
import type { CoachStoryResponse } from '../api/coachApi';

const SHELL_CLASS = 'mx-auto w-full max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12';

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
  const monthlyInsights = useMonthlyInsights();
  const coachStory = useCoachStory({ days: 30, autoFetch: true });
  const monthSummary = useMonthSummary({ autoFetch: true });
  const quests = useQuests();
  const { data: gamification, isLoading: gamificationLoading, error: gamificationError } = useGamificationData();

  // Freshness state tracking - session-local only
  const [monthSummaryFresh, setMonthSummaryFresh] = useState(false);
  const [coachStoryFresh, setCoachStoryFresh] = useState(false);
  const [walletFresh, setWalletFresh] = useState(false);
  const timeoutRefs = useRef<{
    monthSummary?: NodeJS.Timeout;
    coachStory?: NodeJS.Timeout;
    wallet?: NodeJS.Timeout;
  }>({});
  const hasMountedRef = useRef(false);
  const previousDataRef = useRef<{
    monthSummary?: MonthSummary | null;
    coachStory?: CoachStoryResponse | null;
    wallet?: typeof dashboard.summary;
  }>({});

  // Track initial mount to prevent freshness on first load
  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

  // Subscribe to data mutations and set freshness flags
  useEffect(() => {
    const unsubscribe = subscribeToDataMutations((detail) => {
      // When data mutations occur, the hooks will automatically refetch
      // We'll set freshness when the hooks' data actually updates (see effects below)
    });

    return unsubscribe;
  }, []);

  // Watch for data changes after mutations to set freshness
  useEffect(() => {
    // Only set fresh if data actually changed (not just on initial load)
    const dataChanged = hasMountedRef.current && 
      previousDataRef.current.monthSummary !== monthSummary.data;

    if (dataChanged && monthSummary.data && !monthSummary.isLoading) {
      // Clear existing timeout
      if (timeoutRefs.current.monthSummary) {
        clearTimeout(timeoutRefs.current.monthSummary);
      }

      setMonthSummaryFresh(true);
      // Reset after 6 seconds
      timeoutRefs.current.monthSummary = setTimeout(() => {
        setMonthSummaryFresh(false);
      }, 6000);
    }

    // Update previous data ref
    previousDataRef.current.monthSummary = monthSummary.data || null;

    return () => {
      if (timeoutRefs.current.monthSummary) {
        clearTimeout(timeoutRefs.current.monthSummary);
      }
    };
  }, [monthSummary.data, monthSummary.isLoading]);

  useEffect(() => {
    // Only set fresh if data actually changed (not just on initial load)
    const dataChanged = hasMountedRef.current && 
      previousDataRef.current.coachStory !== coachStory.story;

    if (dataChanged && coachStory.story && !coachStory.isLoading) {
      // Clear existing timeout
      if (timeoutRefs.current.coachStory) {
        clearTimeout(timeoutRefs.current.coachStory);
      }

      setCoachStoryFresh(true);
      // Reset after 6 seconds
      timeoutRefs.current.coachStory = setTimeout(() => {
        setCoachStoryFresh(false);
      }, 6000);
    }

    // Update previous data ref
    previousDataRef.current.coachStory = coachStory.story || null;

    return () => {
      if (timeoutRefs.current.coachStory) {
        clearTimeout(timeoutRefs.current.coachStory);
      }
    };
  }, [coachStory.story, coachStory.isLoading]);

  // Watch dashboard refetch for wallet freshness
  useEffect(() => {
    // Only set fresh if data actually changed (not just on initial load)
    const dataChanged = hasMountedRef.current && 
      previousDataRef.current.wallet !== dashboard.summary;

    if (dataChanged && dashboard.summary && !dashboard.loading) {
      // Clear existing timeout
      if (timeoutRefs.current.wallet) {
        clearTimeout(timeoutRefs.current.wallet);
      }

      setWalletFresh(true);
      // Reset after 6 seconds
      timeoutRefs.current.wallet = setTimeout(() => {
        setWalletFresh(false);
      }, 6000);
    }

    // Update previous data ref
    previousDataRef.current.wallet = dashboard.summary;

    return () => {
      if (timeoutRefs.current.wallet) {
        clearTimeout(timeoutRefs.current.wallet);
      }
    };
  }, [dashboard.summary, dashboard.loading]);

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
        <main className="flex-1 pb-10">
          <div className={SHELL_CLASS}>
            <section className="mt-4">
              <DashboardEmptyState
                onImported={dashboard.refetch}
                onNavigateToImports={() => navigate('/imports')}
              />
            </section>
          </div>
        </main>
      </AppShell>
    );
  }

  const income = summary?.kpis.income30d ?? 0;
  const expenses = summary?.kpis.expenses30d ?? 0;
  const balance = summary?.kpis.currentBalance ?? 0;
  const savingsRate = income > 0 ? Math.max(0, Math.min(1, (income - expenses) / income)) : 0;

  // Calculate Sonstiges share for attention card
  const totalExpenses = (summary?.spendingByCategory ?? []).reduce((sum, cat) => sum + cat.amount, 0);
  const otherCategory = (summary?.spendingByCategory ?? []).find(
    cat => cat.category === 'other' || cat.category === 'other_review',
  );
  const otherAmount = otherCategory?.amount ?? 0;
  const otherShare = totalExpenses > 0 ? otherAmount / totalExpenses : 0;
  const otherCount = otherCategory ? (otherCategory as any).count : undefined;
  const showSonstigesCard = otherShare > 0.05 || otherAmount > 0;

  return (
    <AppShell>
      <main className="flex-1 pb-10">
        <div className={SHELL_CLASS}>
          {/* Dashboard Grid Layout - Consistent full/half-width system for future drag-and-drop */}
          <div className="py-4 sm:py-5 space-y-4 sm:space-y-5">
            {/* Gamification HUD */}
            <GamificationHud
              data={gamification}
              isLoading={gamificationLoading}
              error={gamificationError}
            />
            
            {/* Quest Strip - Integrated, thinner cards (2 columns on desktop) */}
            <QuestStrip
              quests={quests.quests}
              isLoading={quests.isLoading}
              error={quests.error}
              onRefresh={quests.refetch}
            />

            {/* Row 1: Wallet Overview - Full Width */}
            <section className="col-span-full">
              <WalletOverview gridColumns={2} isFresh={walletFresh} />
            </section>

            {/* Row 1.5: Health Cards - Two half-width cards side by side */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Money Health Card */}
              <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-5 sm:p-6 lg:p-7 shadow-elevated transition-all duration-200 ease-out hover:scale-[1.01] hover:shadow-lg motion-reduce:transform-none motion-reduce:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-nf-bg-card">
                <div className="mb-4">
                  <p className="text-[11px] uppercase tracking-wide text-nf-text-muted mb-1">
                    Money Health
                  </p>
                  <p className="text-[10px] text-nf-text-soft">
                    Letzte 90 Tage
                  </p>
                </div>
                <div className="relative h-20 w-20 mx-auto mb-3">
                  <svg className="absolute inset-0 -rotate-90 transform" viewBox="0 0 80 80">
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="6"
                      className="text-nf-border-subtle"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="6"
                      strokeDasharray={`${2 * Math.PI * 36}`}
                      strokeDashoffset={`${2 * Math.PI * 36 * (1 - 0.82)}`}
                      strokeLinecap="round"
                      className="text-nf-positive transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center tabular-nums text-lg font-bold text-nf-positive">
                    82%
                  </span>
                </div>
                <p className="text-center text-xs text-nf-text-muted">
                  Basierend auf deinen letzten 90 Tagen.
                </p>
              </div>
              {/* Dein Monat Card */}
              <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-5 sm:p-6 lg:p-7 shadow-elevated transition-all duration-200 ease-out hover:scale-[1.01] hover:shadow-lg motion-reduce:transform-none motion-reduce:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-nf-bg-card">
                <MonthlySnapshotCard insights={monthlyInsights} noCard />
              </div>
            </section>

            {/* Row 2: Charts - Full Width */}
            <section className="col-span-full">
              <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-5 sm:p-6 lg:p-7 shadow-elevated transition-all duration-200 ease-out hover:scale-[1.01] hover:shadow-lg motion-reduce:transform-none motion-reduce:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-nf-bg-card">
                <DashboardChartsHub
                  balance={summary?.balanceOverTime ?? []}
                  cashflow={summary?.cashflowByMonth ?? []}
                  categorySlices={categorySlices}
                  loading={dashboard.loading}
                  dateRangeLabel={dashboard.selectedPeriodOption.label}
                  onCategoryClick={categoryId => navigateToTransactions({ category: categoryId })}
                />
              </div>
            </section>

            {/* Row 2.5: Month Glance + Coach Story Cards - Two half-width cards */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MonthGlanceCard
                summary={monthSummary.data?.summary || null}
                narrative={monthSummary.data?.narrative || null}
                isLoading={monthSummary.isLoading}
                error={monthSummary.error}
                onRefresh={monthSummary.refetch}
                isFresh={monthSummaryFresh}
              />
              <CoachStoryCard
                storyResponse={coachStory.story}
                isLoading={coachStory.isLoading}
                error={coachStory.error}
                onRefresh={coachStory.refetch}
                isFresh={coachStoryFresh}
              />
            </section>

            {/* Row 2.6: Achievements Teaser - Full Width */}
            <section className="col-span-full">
              <AchievementsTeaser isFresh={false} />
            </section>

            {/* Error / Early state messages */}
            {dashboard.error ? (
              <div className="rounded-2xl border border-nf-negative/30 bg-nf-negative/10 px-4 py-3 text-sm text-nf-negative">
                {dashboard.error}
              </div>
            ) : null}

            {dashboard.uiState === 'early' ? (
              <div className="rounded-2xl border border-nf-primary/30 bg-nf-primary-soft px-4 py-3 text-xs text-nf-primary">
                Importiere weitere Konten, um ein vollständiges Bild zu erhalten. Jede CSV verbessert deine Analysen.
              </div>
            ) : null}

            {/* Row 3: Tasks / Cleanup */}
            {(reviewCounts.uncategorized > 0 || reviewCounts.lowConfidence > 0 || showSonstigesCard) && (
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Zu prüfen */}
                {(reviewCounts.uncategorized > 0 || reviewCounts.lowConfidence > 0) && (
                  <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-5 sm:p-6 lg:p-7 shadow-elevated transition-all duration-200 ease-out hover:scale-[1.01] hover:shadow-lg motion-reduce:transform-none motion-reduce:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-nf-bg-card">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-lg">👀</span>
                      <h3 className="text-base font-semibold text-nf-text-main">Zu prüfen</h3>
                    </div>
                    <div className="space-y-2">
                      {reviewCounts.uncategorized > 0 && (
                        <button
                          onClick={() => navigateToTransactions({ category: 'other' })}
                          className="flex w-full items-center justify-between gap-3 rounded-lg border border-nf-border-subtle bg-nf-bg-card-subtle px-4 py-3 text-sm font-medium text-nf-text-main transition hover:bg-nf-bg-card"
                        >
                          <span>Unkategorisiert</span>
                          <span className="tabular-nums font-semibold text-nf-text-main">
                            {reviewLoading ? '—' : reviewCounts.uncategorized.toLocaleString('de-DE')}
                          </span>
                        </button>
                      )}
                      {reviewCounts.lowConfidence > 0 && (
                        <button
                          onClick={() => navigateToTransactions({})}
                          className="flex w-full items-center justify-between gap-3 rounded-lg border border-nf-border-subtle bg-nf-bg-card-subtle px-4 py-3 text-sm font-medium text-nf-text-main transition hover:bg-nf-bg-card"
                        >
                          <span>Niedrige Confidence</span>
                          <span className="tabular-nums font-semibold text-nf-text-main">
                            {reviewLoading ? '—' : reviewCounts.lowConfidence.toLocaleString('de-DE')}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Sonstiges aufräumen */}
                {showSonstigesCard ? (
                  <div className="rounded-3xl border border-nf-warning/30 bg-nf-warning/10 p-5 sm:p-6 lg:p-7 shadow-elevated transition-all duration-200 ease-out hover:scale-[1.01] hover:shadow-lg motion-reduce:transform-none motion-reduce:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-nf-bg-card">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🧹</span>
                        <h3 className="text-base font-semibold text-nf-warning">Sonstiges aufräumen</h3>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                        Empfohlen
                      </span>
                    </div>
                    <div className="mb-4">
                      <p className="text-2xl font-bold tabular-nums text-nf-warning mb-1">
                        {formatCurrency(otherAmount)}
                      </p>
                      <p className="text-xs text-nf-warning/80">
                        {formatPercent(otherShare)} deiner Ausgaben
                      </p>
                      {otherCount !== undefined && (
                        <p className="text-xs text-nf-warning/70 mt-1">
                          {otherCount.toLocaleString('de-DE')} Buchungen
                        </p>
                      )}
                    </div>
                    <a
                      href="/review/sonstiges"
                      className="inline-flex w-full items-center justify-center rounded-lg bg-nf-warning px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-nf-warning/90 focus:outline-none focus:ring-2 focus:ring-nf-warning focus:ring-offset-2"
                    >
                      Bereinigen
                    </a>
                  </div>
                ) : null}
              </section>
            )}

            {/* Admin controls - only in dev, at bottom */}
            {import.meta.env.DEV && (
              <section>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <button
                    onClick={() => setManageImportsOpen(true)}
                    className="text-sm text-slate-600 dark:text-slate-400"
                  >
                    Manage Imports
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
      <ManageImportsDialog
        open={manageImportsOpen}
        onClose={() => setManageImportsOpen(false)}
        onDeleted={dashboard.refetch}
      />
    </AppShell>
  );
};

export default Dashboard;
