import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { fetchReviewTransactions, fetchCategories, ReviewTransaction, CategoryMeta, fetchReimbursementGroups, type ReimbursementGroup } from '../api/reviewApi';
import { AlertCircle } from 'lucide-react';
import { AppShell } from '../layout/AppShell';
import { fetchSubscriptionCandidates, type SubscriptionCandidate } from '../lib/api/subscriptions';
import { ReimbursementsReviewCard } from '../components/review/ReimbursementsReviewCard';
import { SonstigesTransactionRow, type AiSuggestionData } from '../components/review/SonstigesTransactionRow';
import { AiCleanupSummaryBar } from '../components/review/AiCleanupSummaryBar';
import CategoryControl from '../components/CategoryControl';
import { formatCurrency } from '../lib/format';
import { getTransactionDisplayName } from '../lib/transactions/displayName';
import { useBatchAiSuggestions } from '../hooks/useBatchAiSuggestions';

interface CategoryIndex {
  [id: string]: CategoryMeta;
}

// Session Celebration Banner Component
function SessionCelebrationBanner({ hasShown }: { hasShown: boolean }) {
  return (
    <div className="mb-4 rounded-3xl border border-emerald-500/40 bg-emerald-900/40 backdrop-blur-sm px-4 py-3 text-sm text-emerald-50 shadow-elevated dark:shadow-elevated flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🎉</span>
          <span className="font-semibold">Alles erledigt für heute</span>
        </div>
        <p className="text-xs text-emerald-700 dark:text-emerald-200">
          Nimbus hat dir gerade nichts mehr zum Aufräumen.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <Link
          to="/dashboard"
          className="inline-flex items-center rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-emerald-50 hover:bg-emerald-700 hover:shadow-glow-primary dark:bg-emerald-500 dark:hover:bg-emerald-400 transition-all duration-200"
        >
          Dashboard öffnen
        </Link>
        <span className="inline-flex items-center rounded-full border border-emerald-200/70 px-3 py-1.5 text-[11px] font-medium text-emerald-900/80 dark:border-emerald-500/40 dark:text-emerald-50/80">
          Mehr Auswertungen (bald)
        </span>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const focusedReimbursementGroupId = searchParams.get('focusReimbursementGroup') ?? null;
  
  const [transactions, setTransactions] = useState<ReviewTransaction[]>([]);
  const [categories, setCategories] = useState<CategoryIndex>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hiddenTransactionIds, setHiddenTransactionIds] = useState<Set<string>>(new Set());
  const [aiSuggestionData, setAiSuggestionData] = useState<Map<string, AiSuggestionData>>(new Map());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [txs, cats] = await Promise.all([
          fetchReviewTransactions(),
          fetchCategories(),
        ]);

        if (cancelled) return;

        const index: CategoryIndex = {};
        for (const c of cats) {
          index[c.id] = c;
        }

        setTransactions(txs);
        setCategories(index);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? 'Unbekannter Fehler');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Categorization quality panel data
  const [quality, setQuality] = useState<{
    otherSharePct: number;
    transfersCount: number;
    refundsCount: number;
    reimbursementsCount: number;
    passThroughCount: number;
  } | null>(null);

  // Subscription candidates
  const [subscriptionCandidates, setSubscriptionCandidates] = useState<SubscriptionCandidate[]>([]);
  const [subscriptionCandidatesLoading, setSubscriptionCandidatesLoading] = useState(false);

  // Reimbursement groups state
  const [reimbursementGroups, setReimbursementGroups] = useState<ReimbursementGroup[]>([]);
  const [resolvedGroupIds, setResolvedGroupIds] = useState<Set<string>>(new Set());
  const [hasShownSessionCelebration, setHasShownSessionCelebration] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadQuality() {
      try {
        // Month from backend default
        const [catsRes, itRes, recentRes] = await Promise.all([
          fetch('/api/summary/categories'),
          fetch('/api/summary/internal-transfers'),
          fetch('/api/transactions/recent?limit=500'),
        ]);
        const catsJson = await catsRes.json();
        const itJson = await itRes.json();
        const recentJson = await recentRes.json();

        // Compute "other" share from categories
        const catRows: Array<{ category: string; rawExpenseCents: number }> = catsJson?.data ?? [];
        const otherRows = catRows.filter((r) => r.category === 'other' || r.category === 'other_review');
        const otherSum = otherRows.reduce((acc, r) => acc + (r.rawExpenseCents || 0), 0);
        const totalExpense = catRows.reduce((acc, r) => acc + (r.category?.startsWith('income_') ? 0 : (r.rawExpenseCents || 0)), 0);
        const otherSharePct = totalExpense > 0 ? (otherSum / totalExpense) * 100 : 0;

        // Transfers count (outgoing transfers sum across kinds)
        const transfersCount = Math.round(
          ((itJson?.totals?.savingsOutCents ?? 0) +
            (itJson?.totals?.walletOutCents ?? 0) +
            (itJson?.totals?.otherOutCents ?? 0)) / 100
        );

        // Approximate counts from recent (best-effort without dedicated endpoints)
        const rec: any[] = recentJson?.transactions ?? [];
        const refundsCount = rec.filter((r) => r.isRefund || r.isRefunded).length;
        const reimbursementsCount = rec.filter((r) => r.isReimbursement).length;
        const passThroughCount = rec.filter((r) => r.isPassThrough).length;

        if (!cancelled) {
          setQuality({
            otherSharePct,
            transfersCount,
            refundsCount,
            reimbursementsCount,
            passThroughCount,
          });
        }
      } catch {
        if (!cancelled) setQuality(null);
      }
    }
    void loadQuality();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load subscription candidates
  useEffect(() => {
    let cancelled = false;
    async function loadCandidates() {
      try {
        setSubscriptionCandidatesLoading(true);
        const candidates = await fetchSubscriptionCandidates(365);
        if (!cancelled) {
          setSubscriptionCandidates(candidates);
        }
      } catch (err) {
        console.error('[Review] Failed to load subscription candidates', err);
      } finally {
        if (!cancelled) {
          setSubscriptionCandidatesLoading(false);
        }
      }
    }
    void loadCandidates();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load reimbursement groups
  useEffect(() => {
    let cancelled = false;
    async function loadReimbursementGroups() {
      try {
        const groups = await fetchReimbursementGroups();
        if (!cancelled) {
          setReimbursementGroups(groups);
        }
      } catch (err) {
        console.error('[Review] Failed to load reimbursement groups', err);
      }
    }
    void loadReimbursementGroups();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pagination constant - align with Transactions page for consistency
  const SONSTIGES_PAGE_SIZE = 50;

  // Calculate "Sonstiges" transactions and progress data at top level
  // Filter out payment provider funding transfers - these should never appear in Sonstiges cleanup
  // (Backend already excludes isInternalTransfer, but we add explicit filter for safety)
  const sonstigesTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // Exclude internal transfers (including payment_provider_funding)
      // These are not real expenses and should not get AI suggestions
      if (tx.isInternalTransfer) return false;
      // Only include transactions with no category or 'other' category
      return !tx.category || tx.category === 'other';
    });
  }, [transactions]);

  // Pagination state for Sonstiges transactions
  // This allows users to load more transactions incrementally, keeping AI batch work scoped to visible subset
  const [sonstigesPage, setSonstigesPage] = useState(1);

  // Filter visible "Sonstiges" transactions (exclude hidden ones)
  const allVisibleSonstiges = useMemo(() => {
    return sonstigesTransactions.filter(tx => !hiddenTransactionIds.has(tx.id));
  }, [sonstigesTransactions, hiddenTransactionIds]);

  // Paginated visible Sonstiges - only show first N pages worth
  // This scopes AI batch suggestions to what the user is actually viewing (token/cost control)
  const visibleSonstiges = useMemo(() => {
    return allVisibleSonstiges.slice(0, sonstigesPage * SONSTIGES_PAGE_SIZE);
  }, [allVisibleSonstiges, sonstigesPage]);

  // Check if there are more Sonstiges to load
  const hasMoreSonstiges = allVisibleSonstiges.length > visibleSonstiges.length;

  // Memoize transaction IDs array to prevent unnecessary re-renders
  // Sort and deduplicate to ensure stable reference when IDs are the same
  const visibleSonstigesIds = useMemo(() => {
    const ids = visibleSonstiges.map(tx => tx.id);
    // Sort to ensure stable order, then deduplicate
    return Array.from(new Set(ids)).sort();
  }, [visibleSonstiges]);

  // Batch AI suggestions for all visible Sonstiges transactions
  // Note: The hook handles caching, batching, and rate limiting automatically.
  // It's safe to pass all visible transaction IDs - the hook will:
  // - Only request IDs that aren't already cached
  // - Batch requests into chunks of 50
  // - Limit concurrent requests to 2 at a time
  // - Respect rate limits and fail gracefully
  const batchAiSuggestions = useBatchAiSuggestions(
    visibleSonstigesIds,
    visibleSonstiges.length > 0 && !loading,
  );

  // Sort visible Sonstiges by AI confidence buckets (high → medium → low)
  // Also consider batch suggestions when sorting
  // Note: Uses getSuggestion callback which is stable, so batchAiSuggestions object reference changes don't trigger re-sort
  const getSuggestion = batchAiSuggestions.getSuggestion;
  const sortedVisibleSonstiges = useMemo(() => {
    const getConfidenceBucket = (tx: ReviewTransaction): number => {
      // Check batch suggestions first, then individual suggestions
      const batchSuggestion = getSuggestion(tx.id);
      const individualSuggestion = aiSuggestionData.get(tx.id)?.suggestion;
      const suggestion = batchSuggestion || individualSuggestion;
      
      if (!suggestion) return 3; // No suggestion = lowest priority
      if (suggestion.confidence >= 0.9) return 0; // High
      if (suggestion.confidence >= 0.75) return 1; // Medium
      return 2; // Low
    };

    return [...visibleSonstiges].sort((a, b) => {
      const bucketA = getConfidenceBucket(a);
      const bucketB = getConfidenceBucket(b);
      if (bucketA !== bucketB) return bucketA - bucketB;
      
      // Within same bucket, sort by confidence descending
      const batchA = getSuggestion(a.id);
      const batchB = getSuggestion(b.id);
      const individualA = aiSuggestionData.get(a.id)?.suggestion;
      const individualB = aiSuggestionData.get(b.id)?.suggestion;
      const confA = (batchA || individualA)?.confidence ?? 0;
      const confB = (batchB || individualB)?.confidence ?? 0;
      return confB - confA;
    });
  }, [visibleSonstiges, aiSuggestionData, getSuggestion]);

  // Handler for suggestion data updates from rows
  // Use useCallback to ensure stable reference across renders
  // Use functional setState with deep equality check to avoid unnecessary updates
  const handleSuggestionDataChange = useCallback((data: AiSuggestionData) => {
    setAiSuggestionData(prev => {
      const existing = prev.get(data.transactionId);
      
      // Only update if the meaningful data has actually changed
      // Compare suggestion, isLoading, and hasFetched
      if (existing) {
        const suggestionChanged = existing.suggestion?.categoryId !== data.suggestion?.categoryId ||
                                  existing.suggestion?.confidence !== data.suggestion?.confidence;
        const loadingChanged = existing.isLoading !== data.isLoading;
        const fetchedChanged = existing.hasFetched !== data.hasFetched;
        
        if (!suggestionChanged && !loadingChanged && !fetchedChanged) {
          // No meaningful change, return previous state to avoid re-render
          return prev;
        }
      }
      
      // Create new Map with updated data
      const next = new Map(prev);
      next.set(data.transactionId, data);
      return next;
    });
  }, []);

  // Batch accept high-confidence suggestions (from both batch and individual suggestions)
  // Use useCallback since this function is passed as a prop to AiCleanupSummaryBar
  const handleBatchAccept = useCallback(async () => {
      // Collect high-confidence suggestions from both sources
      const highConfidence: Array<{ transactionId: string; suggestion: import('../api/aiCategoryApi').AiCategorySuggestion }> = [];
      
      // From batch suggestions
      for (const tx of visibleSonstiges) {
        const batchSuggestion = batchAiSuggestions.getSuggestion(tx.id);
        if (batchSuggestion && batchSuggestion.confidence >= 0.9) {
          highConfidence.push({
            transactionId: tx.id,
            suggestion: batchSuggestion,
          });
        }
      }
      
      // From individual suggestions (avoid duplicates)
      const batchIds = new Set(highConfidence.map(h => h.transactionId));
      for (const data of aiSuggestionData.values()) {
        if (!batchIds.has(data.transactionId) && data.suggestion && data.suggestion.confidence >= 0.9) {
          highConfidence.push({
            transactionId: data.transactionId,
            suggestion: data.suggestion,
          });
        }
      }

      if (highConfidence.length === 0) return;

      setIsBatchProcessing(true);
      const errors: string[] = [];

      for (const { transactionId, suggestion } of highConfidence) {
        try {
          // Find the transaction
          const tx = transactions.find(t => t.id === transactionId);
          if (!tx) continue;

          // Call the same API that CategoryControl uses
          const fingerprintInput = {
            bookingDate: tx.bookingDate,
            valueDate: tx.bookingDate,
            amountCents: tx.amountCents,
            currency: tx.currency,
            purpose: tx.rawText,
            counterpartName: tx.categoryExplanation?.merchantName ?? null,
            accountIban: null,
          };

          // Compute fingerprint (same logic as CategoryControl)
          const norm = (value?: string | null) => (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
          const account = (fingerprintInput.accountIban ?? '').replace(/\s+/g, '').toUpperCase();
          const payload = [
            fingerprintInput.bookingDate ?? '',
            fingerprintInput.valueDate ?? '',
            String(fingerprintInput.amountCents ?? 0),
            (fingerprintInput.currency ?? 'EUR').toUpperCase(),
            norm(fingerprintInput.purpose),
            norm(fingerprintInput.counterpartName),
            account,
          ].join('|');

          const encoder = new TextEncoder();
          const data = encoder.encode(payload);
          const digest = await crypto.subtle.digest('SHA-256', data);
          const resolvedId = Array.from(new Uint8Array(digest))
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('');

          // Update category via API
          const res = await fetch('/api/overrides', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: resolvedId, category: suggestion.categoryId }),
          });

          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json?.message ?? 'Kategorie konnte nicht gesetzt werden.');
          }

          // Send AI feedback
          try {
            await fetch('/api/ai/category-feedback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                transactionId,
                suggestedCategoryId: suggestion.categoryId,
                accepted: true,
              }),
            });
          } catch {
            // Feedback is not critical, continue
          }

          // Update local state
          const previousCategoryId = tx.category;
          setTransactions(prev =>
            prev.map(t =>
              t.id === transactionId ? { ...t, category: suggestion.categoryId, categorySource: 'user' } : t
            )
          );

          // Hide if moved away from "Sonstiges"
          const isPreviouslyOther = !previousCategoryId || previousCategoryId === 'other';
          const isNowOther = !suggestion.categoryId || suggestion.categoryId === 'other';
          if (isPreviouslyOther && !isNowOther) {
            setHiddenTransactionIds(prev => {
              const next = new Set(prev);
              next.add(transactionId);
              return next;
            });
          }

          // Update suggestion data to mark as applied
          setAiSuggestionData(prev => {
            const next = new Map(prev);
            const existing = next.get(transactionId);
            if (existing) {
              next.set(transactionId, {
                ...existing,
                suggestion: null, // Clear suggestion after applying
              });
            }
            return next;
          });
        } catch (error: any) {
          console.error(`[Review] Failed to apply suggestion for ${transactionId}:`, error);
          errors.push(transactionId);
        }
      }

      setIsBatchProcessing(false);

      if (errors.length > 0) {
        // Show error message (could use toast library if available)
          alert('Eine oder mehrere Buchungen konnten nicht aktualisiert werden. Bitte später erneut versuchen.');
      }
  }, [visibleSonstiges, batchAiSuggestions, aiSuggestionData, transactions]);

  // For the main transaction list, show all transactions EXCEPT "Sonstiges" (they get their own card)
  const visibleTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const isSonstiges = !tx.category || tx.category === 'other';
      // Exclude all Sonstiges from the main list (they're in the dedicated card)
      return !isSonstiges;
    });
  }, [transactions]);

  // Progress counter data (computed at top level, no hooks in JSX)
  // Note: remaining uses allVisibleSonstiges (not paginated) to show true progress
  const progressData = useMemo(() => {
    const total = sonstigesTransactions.length;
    const cleaned = hiddenTransactionIds.size;
    const remaining = allVisibleSonstiges.length; // Use all visible, not just paginated subset
    const hasVisibleSonstiges = remaining > 0;
    
    return {
      total,
      cleaned,
      remaining,
      hasVisibleSonstiges,
      isComplete: total > 0 && remaining === 0,
      // Legacy fields for backward compatibility
      totalSonstiges: total,
      cleanedCount: cleaned,
    };
  }, [sonstigesTransactions.length, hiddenTransactionIds.size, allVisibleSonstiges.length]);

  // Derived state for overview strip (computed after all hooks, no new hooks)
  const hasSonstiges = progressData.total > 0;
  const hasRemainingSonstiges = hasSonstiges && progressData.remaining > 0;
  const aboCount = subscriptionCandidates.length;

  // Derived state for session completion
  const hasOpenReimbursements = useMemo(() => {
    if (!reimbursementGroups.length) return false;
    // A group is considered "resolved" if its id is in resolvedGroupIds
    const unresolved = reimbursementGroups.filter(g => !resolvedGroupIds.has(g.groupId));
    return unresolved.length > 0;
  }, [reimbursementGroups, resolvedGroupIds]);

  const hasAboCandidates = aboCount > 0;
  const hasAnyWorkLeft = hasOpenReimbursements || hasRemainingSonstiges || hasAboCandidates;
  const isSessionFinished = !loading && !hasAnyWorkLeft;

  // Track when we first hit the finished state
  useEffect(() => {
    if (isSessionFinished && !hasShownSessionCelebration) {
      setHasShownSessionCelebration(true);
    }
  }, [isSessionFinished, hasShownSessionCelebration]);

  // Helper to check if a transaction matches a subscription candidate
  // Use useCallback since this function is passed as a prop to SonstigesTransactionRow
  const getSubscriptionCandidate = useCallback((tx: ReviewTransaction): SubscriptionCandidate | null => {
      // Only consider expenses (negative amounts)
      if ((tx.amountCents ?? 0) >= 0) return null;
      
      // Only consider transactions that are not already in subscription categories
      const category = tx.category;
      if (category === 'subscriptions' || category === 'subscriptions:streaming') {
        return null;
      }

      // Match by merchant name from categoryExplanation or rawText
      const merchantName = tx.categoryExplanation?.merchantName ?? tx.rawText ?? '';
      const merchantLower = merchantName.toLowerCase().trim();
      
      if (!merchantLower) return null;
      
      // Check if merchant matches any candidate
      for (const candidate of subscriptionCandidates) {
        const candidateKeyLower = candidate.merchantKey.toLowerCase();
        const candidateDisplayLower = candidate.displayName.toLowerCase().trim();
        
        // Match by normalized key or display name
        if (merchantLower.includes(candidateKeyLower) || 
            candidateKeyLower.includes(merchantLower) ||
            merchantLower.includes(candidateDisplayLower) ||
            candidateDisplayLower.includes(merchantLower)) {
          return candidate;
        }
      }
      
      return null;
  }, [subscriptionCandidates]);

  // Scroll helper function (no hooks)
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const content = (() => {
    if (loading) {
      return (
        <div className="flex flex-col gap-8">
          <header className="flex flex-col gap-2 mb-6">
            <div className="text-lg md:text-xl font-medium text-slate-700 dark:text-slate-300">Überprüfung</div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Lade verdächtige Buchungen…</p>
          </header>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col gap-8">
          <header className="flex flex-col gap-2 mb-6">
            <div className="text-lg md:text-xl font-medium text-slate-700 dark:text-slate-300">Überprüfung</div>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </header>
        </div>
      );
    }

    if (transactions.length === 0) {
      return (
        <div className="flex flex-col gap-8">
          <header className="flex flex-col gap-2 mb-6">
            <div className="text-lg md:text-xl font-medium text-slate-700 dark:text-slate-300">Überprüfung</div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Keine Buchungen zur Überprüfung – sehr gut! ✨
            </p>
          </header>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2 mb-6">
          <div className="text-lg md:text-xl font-medium text-slate-700 dark:text-slate-300">Überprüfung</div>
          <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Zeigt Buchungen mit unsicherer Kategorie oder geringer Trefferquote.
          </p>
        </header>

        {/* Session Celebration Banner */}
        {isSessionFinished && (
          <SessionCelebrationBanner hasShown={hasShownSessionCelebration} />
        )}

        {/* Review Overview Strip */}
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {/* Tile 1: Erstattungen */}
          <button
            type="button"
            onClick={() => scrollToSection('reimbursements-section')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                scrollToSection('reimbursements-section');
              }
            }}
            aria-label="Zu Erstattungen springen"
            className="group flex flex-col justify-between rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm px-3.5 py-3 text-left shadow-elevated transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-nf-primary/40 hover:shadow-2xl hover:ring-2 hover:ring-nf-primary/20 dark:shadow-elevated"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-300 text-xs w-6 h-6">
                💸
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">Erstattungen</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Offene Erstattungen & durchlaufende Posten prüfen
            </p>
          </button>

          {/* Tile 2: Sonstiges */}
          <button
            type="button"
            onClick={() => scrollToSection('sonstiges-section')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                scrollToSection('sonstiges-section');
              }
            }}
            aria-label="Zu Sonstiges aufräumen springen"
            className={`group flex flex-col justify-between rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm px-3.5 py-3 text-left shadow-elevated transition-all duration-200 ease-out hover:-translate-y-[1px] hover:shadow-2xl hover:ring-2 hover:ring-nf-primary/20 dark:shadow-elevated ${
              hasRemainingSonstiges
                ? 'border-nf-primary/40 bg-nf-primary-soft'
                : ''
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-300 text-xs w-6 h-6">
                🧹
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">Sonstiges aufräumen</span>
            </div>
            {hasSonstiges ? (
              <>
                {progressData.remaining > 0 ? (
                  <>
                    <p className="text-xs font-medium text-slate-900 dark:text-slate-50 mb-1">
                      Noch {progressData.remaining} Buchungen
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      🧹 Aufgeräumt: {progressData.cleaned} von {progressData.total}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">
                      Alles aufgeräumt ✨
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Neue "Sonstiges"-Buchungen landen automatisch hier.
                    </p>
                  </>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Keine "Sonstiges"-Buchungen gefunden
              </p>
            )}
          </button>

          {/* Tile 3: Verträge & Abos */}
          <button
            type="button"
            onClick={() => scrollToSection('subscriptions-section')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                scrollToSection('subscriptions-section');
              }
            }}
            aria-label="Zu Verträge & Abos springen"
            className={`group flex flex-col justify-between rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm px-3.5 py-3 text-left shadow-elevated transition-all duration-200 ease-out hover:-translate-y-[1px] hover:shadow-2xl hover:ring-2 hover:ring-nf-primary/20 dark:shadow-elevated ${
              aboCount > 0
                ? 'border-nf-accent-warning/40 bg-nf-accent-warning/10'
                : ''
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs w-6 h-6">
                📄
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">Verträge & Abos</span>
            </div>
            {aboCount > 0 ? (
              <>
                <p className="text-xs font-medium text-slate-900 dark:text-slate-50 mb-1">
                  {aboCount} mögliche Abos
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Prüfe, ob du Verträge optimieren oder kündigen willst.
                </p>
              </>
            ) : (
              <>
                <p className="text-xs font-medium text-slate-900 dark:text-slate-50 mb-1">
                  Keine Abos gefunden
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Wir melden uns, wenn wir neue Verträge entdecken.
                </p>
              </>
            )}
          </button>
        </div>

        {/* Quality Panel */}
        <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm p-4 shadow-elevated dark:shadow-elevated">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-600 dark:text-slate-300">Datenqualität & Kategorien</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">
                {quality ? `${quality.otherSharePct.toFixed(1)} % deiner Ausgaben sind 'Sonstiges'` : '—'}
              </div>
              {quality && quality.otherSharePct > 10 && (
                <span className="mt-2 inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                  Aufräumen empfohlen
                </span>
              )}
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-nf-border-subtle bg-nf-bg-card-subtle backdrop-blur-sm px-3 py-2 text-xs text-nf-text-muted">
                  <p className="font-medium text-slate-700 dark:text-slate-300">Tipp:</p>
                  <p>
                    Klick auf die Kategorie, um sie zu ändern. Mit 'Merken' erstellst du eine persönliche Regel für zukünftige Buchungen von diesem Händler.
                  </p>
                  <p className="mt-2 text-slate-500 dark:text-slate-400">
                    Erstattungen und durchlaufende Posten werden bei deinen Auswertungen neutral behandelt, bleiben aber in der Liste sichtbar.
                  </p>
                </div>
                <a
                  href="/review/sonstiges"
                  className="inline-flex items-center rounded-full bg-nf-primary px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-nf-primary hover:shadow-glow-primary focus:outline-none focus:ring-2 focus:ring-nf-primary/40"
                >
                  Sonstiges bereinigen
                </a>
              </div>
            </div>
            <div className="flex-1">
              <ul className="grid grid-cols-1 gap-2 text-sm text-slate-700 dark:text-slate-300">
                <li className="flex items-center justify-between rounded-2xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm px-3 py-2">
                  <span>Interne Transfers erkannt</span>
                  <span className="font-semibold">{quality ? quality.transfersCount.toLocaleString('de-DE') : '—'}</span>
                </li>
                <li className="flex items-center justify-between rounded-2xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm px-3 py-2">
                  <span>Rückerstattungen</span>
                  <span className="font-semibold">{quality ? quality.refundsCount.toLocaleString('de-DE') : '—'}</span>
                </li>
                <li className="flex items-center justify-between rounded-2xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm px-3 py-2">
                  <span>Durchlaufende Posten</span>
                  <span className="font-semibold">{quality ? quality.passThroughCount.toLocaleString('de-DE') : '—'}</span>
                </li>
                <li className="flex items-center justify-between rounded-2xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm px-3 py-2">
                  <span>Erstattete Ausgaben</span>
                  <span className="font-semibold">
                    {quality ? quality.reimbursementsCount.toLocaleString('de-DE') : '—'}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Verträge & Abos Section */}
        <section id="subscriptions-section" className="mt-6">
          <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm shadow-elevated dark:shadow-elevated p-4 md:p-5">
            <div className="mb-4">
              <h2 className="text-sm md:text-base font-semibold text-slate-900 dark:text-slate-50">
                Verträge & Abos
              </h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {aboCount > 0
                  ? 'Mögliche Abos, die wir in deinen Buchungen gefunden haben.'
                  : 'Hier findest du mögliche Verträge und Abos, die wir in deinen Buchungen entdecken.'}
              </p>
            </div>
            {aboCount > 0 ? (
              <div className="rounded-2xl border border-nf-primary/30 bg-nf-primary-soft backdrop-blur-sm px-4 py-3">
                <div className="mb-2 text-sm font-medium text-indigo-900 dark:text-indigo-200">
                  Mögliche Abos ({aboCount})
                </div>
                <div className="space-y-2">
                  {subscriptionCandidates.slice(0, 3).map((candidate) => (
                    <div
                      key={candidate.merchantKey}
                      className="flex items-center justify-between rounded-2xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm px-3 py-2 text-xs transition-all duration-200 ease-out hover:-translate-y-[1px]"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-slate-900 dark:text-slate-50">{candidate.displayName}</div>
                        <div className="text-slate-600 dark:text-slate-400">
                          {formatCurrency(candidate.avgAmountCents / 100)} · {candidate.txCount} Buchungen ·{' '}
                          {candidate.frequency === 'monthly' ? 'monatlich' : 'jährlich'}
                        </div>
                      </div>
                      <a
                        href={`/transactions?search=${encodeURIComponent(candidate.displayName)}`}
                        className="ml-2 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        Ansehen
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-nf-border-subtle bg-nf-bg-card-subtle backdrop-blur-sm px-4 py-6 text-center">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Keine Abos gefunden. Wir melden uns, wenn wir neue Verträge entdecken.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Reimbursements Hero Section */}
        <section className="mb-6 md:mb-8">
          <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm p-4 md:p-6 shadow-elevated dark:shadow-elevated">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {/* Left: title + explainer */}
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-sm">
                  <span className="font-semibold">N</span>
                </div>
                <div>
                  <h1 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-slate-50">
                    Erstattungen &amp; durchlaufende Posten
                  </h1>
                  <p className="mt-1 text-xs md:text-sm text-slate-600 dark:text-slate-400">
                    Nimbus hilft dir, geliehene und zurückgezahlte Beträge sauber von deinen echten Ausgaben zu trennen.
                  </p>
                </div>
              </div>

              {/* Right: tiny beta pill */}
              <div className="flex items-center gap-2 self-start md:self-auto">
                <span className="inline-flex items-center rounded-full bg-slate-900 text-slate-50 dark:bg-slate-100 dark:text-slate-900 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                  Beta
                </span>
                <span className="hidden md:inline text-xs text-slate-500 dark:text-slate-400">
                  Nur auf diesem Gerät aktiv
                </span>
              </div>
            </div>

            {/* KPIs + filters */}
            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              {/* KPI chips */}
              <div className="flex flex-wrap gap-2 text-xs">
                <div className="inline-flex items-center gap-1 rounded-full bg-white/80 dark:bg-slate-900/70 px-3 py-1 shadow-sm border border-slate-200/70 dark:border-slate-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                  <span className="text-slate-600 dark:text-slate-200">Vorgestreckt:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-50">437,00&nbsp;€</span>
                </div>
                <div className="inline-flex items-center gap-1 rounded-full bg-white/80 dark:bg-slate-900/70 px-3 py-1 shadow-sm border border-slate-200/70 dark:border-slate-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  <span className="text-slate-600 dark:text-slate-200">Zurückbekommen:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-50">218,00&nbsp;€</span>
                </div>
                <div className="inline-flex items-center gap-1 rounded-full bg-white/80 dark:bg-slate-900/70 px-3 py-1 shadow-sm border border-slate-200/70 dark:border-slate-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500"></span>
                  <span className="text-slate-600 dark:text-slate-200">Offen:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-50">219,00&nbsp;€</span>
                </div>
              </div>

              {/* Filter chips */}
              <div className="flex flex-wrap gap-2 text-xs md:justify-end">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full bg-white/80 dark:bg-slate-900/70 px-3 py-1 border border-slate-200/70 dark:border-slate-700 text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition"
                >
                  <span>Alle Personen</span>
                  <span className="text-[10px]">▾</span>
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full bg-white/80 dark:bg-slate-900/70 px-3 py-1 border border-slate-200/70 dark:border-slate-700 text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition"
                >
                  <span>Letzte 90 Tage</span>
                  <span className="text-[10px]">▾</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Reimbursements & Pass-through Manager */}
        <section id="reimbursements-section" className="mt-5">
          <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm shadow-elevated dark:shadow-elevated p-4 md:p-5">
            <div className="mb-4">
              <h2 className="text-sm md:text-base font-semibold text-slate-900 dark:text-slate-50">
                Deine Erstattungs-Muster
              </h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Hier siehst du Zahlungen, bei denen Nimbus vermutet, dass du Geld vorgestreckt oder zurückbekommen hast.
              </p>
            </div>

            <ReimbursementsReviewCard 
              focusedGroupId={focusedReimbursementGroupId}
              resolvedGroupIds={resolvedGroupIds}
              onResolvedGroupIdsChange={setResolvedGroupIds}
            />
          </div>
        </section>

        {/* Sonstiges aufräumen Card */}
        {progressData.total > 0 && (
          <section id="sonstiges-section" className="mt-6">
            <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm shadow-elevated dark:shadow-elevated p-4 md:p-5">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
                {/* Left: Title + Subtitle */}
                <div className="flex-1">
                  <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                    Sonstiges aufräumen
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Sortiere deine uncoolen "Sonstiges"-Buchungen in echte Kategorien ein.
                  </p>
                </div>

                {/* Right: Badge */}
                <div className="flex items-center">
                  {progressData.remaining > 0 ? (
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium bg-sky-500/10 text-sky-600 dark:text-sky-300 border border-sky-500/30 dark:border-sky-500/30">
                      Noch {progressData.remaining}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border border-emerald-500/40 dark:border-emerald-500/40">
                      Fertig ✨
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Text */}
              {progressData.total > 0 && progressData.remaining > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    🧹 Aufgeräumt: {progressData.cleaned} von {progressData.total} Buchungen
                  </p>
                </div>
              )}

              {progressData.total > 0 && progressData.remaining === 0 && (
                <div className="mb-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    🎉 Alles erledigt – hier gibt es gerade nichts mehr zu tun.
                  </p>
                </div>
              )}

              {/* Display count when paginated or when showing subset */}
              {hasMoreSonstiges && (
                <div className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                  Angezeigt: {visibleSonstiges.length} von {sonstigesTransactions.length} Buchungen in 'Sonstiges'
                </div>
              )}

              {/* AI Cleanup Summary Bar */}
              {/* Note: totalTransactions uses allVisibleSonstiges to reflect true total, not just paginated subset */}
              {progressData.remaining > 0 && (
                <AiCleanupSummaryBar
                  suggestionData={aiSuggestionData}
                  totalTransactions={allVisibleSonstiges.length}
                  onBatchAccept={handleBatchAccept}
                  isProcessing={isBatchProcessing}
                  batchSuggestions={batchAiSuggestions.suggestions}
                  batchHasAttempted={batchAiSuggestions.hasAttempted}
                />
              )}

              {/* Sonstiges Transaction List or Empty State */}
              {progressData.remaining > 0 ? (
                <>
                  <div className="space-y-2 divide-y divide-slate-200/70 dark:divide-slate-800/60">
                    {sortedVisibleSonstiges.map(tx => (
                    <SonstigesTransactionRow
                      key={tx.id}
                      tx={tx}
                      categories={categories}
                      getSubscriptionCandidate={getSubscriptionCandidate}
                      onCategoryChange={(txId, newCategory) => {
                        setTransactions(prev =>
                          prev.map(t =>
                            t.id === txId ? { ...t, category: newCategory, categorySource: t.categorySource === 'ai' ? 'ai' : 'user' } : t
                          )
                        );
                      }}
                      onHide={(txId) => {
                        setHiddenTransactionIds(prev => {
                          const next = new Set(prev);
                          next.add(txId);
                          return next;
                        });
                      }}
                      onSuggestionDataChange={handleSuggestionDataChange}
                      WhyButton={WhyButton}
                      batchSuggestion={batchAiSuggestions.getSuggestion(tx.id)}
                      batchHasAttempted={batchAiSuggestions.hasAttempted(tx.id)}
                    />
                  ))}
                  </div>
                  
                  {/* Load more button when there are more Sonstiges */}
                  {hasMoreSonstiges && (
                    <div className="mt-4 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setSonstigesPage(prev => prev + 1)}
                        className="inline-flex items-center gap-2 rounded-lg border border-nf-border-subtle bg-nf-bg-card px-4 py-2 text-sm font-medium text-nf-text-muted transition hover:bg-nf-bg-card-subtle hover:text-nf-text-main focus:outline-none focus:ring-2 focus:ring-nf-primary focus:ring-offset-2"
                      >
                        <span>Mehr Buchungen anzeigen</span>
                        <span className="text-xs text-nf-text-soft">
                          ({allVisibleSonstiges.length - visibleSonstiges.length} weitere)
                        </span>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center py-8 text-center">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 mb-3">
                    <span className="text-lg">🎉</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-1">
                    Alles aufgeräumt 🎉
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-sm">
                    Neue "Sonstiges"-Buchungen landen automatisch hier. Schau einfach ab und zu vorbei.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="text-xs font-medium text-sky-500 dark:text-sky-400 hover:text-sky-600 dark:hover:text-sky-300 underline-offset-2 hover:underline"
                  >
                    Zurück zum Dashboard
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm shadow-elevated dark:shadow-elevated overflow-hidden">
          {/* Section header */}
          <div className="px-4 py-3 md:px-6 md:py-4 border-b border-slate-200 dark:border-slate-800">
            <div className="mb-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span className="uppercase tracking-wide">Letzte Buchungen</span>
            </div>
          </div>

          {/* Transaction list */}
          <div className="divide-y divide-slate-200/50 dark:divide-slate-800/50">
            {visibleTransactions.map(tx => {
              const cat = tx.category ? categories[tx.category] : undefined;
              const label =
                cat?.labelDe ??
                (tx.category ?? 'Unkategorisiert');

              const source = tx.categorySource ?? 'unbekannt';
              const confidence = tx.categoryConfidence ?? 0;
              const isLow = confidence < 0.4;
              const isMedium = confidence >= 0.4 && confidence < 0.8;
              const amountCents = tx.amountCents ?? 0;

              return (
                <div
                  key={tx.id}
                  data-transaction-id={tx.id}
                  className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm px-3 py-2.5 md:px-4 md:py-3 mb-2 shadow-elevated transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-nf-primary/40 hover:shadow-2xl hover:ring-2 hover:ring-nf-primary/20 dark:shadow-elevated"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    {/* Left: Date + Merchant/Purpose */}
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {tx.bookingDate}
                      </span>
                      <span className="text-sm md:text-[15px] font-medium text-slate-900 dark:text-slate-50 truncate">
                        {getTransactionDisplayName(tx)}
                      </span>
                      {tx.categoryExplanation?.matchedText && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {tx.categoryExplanation.matchedText}
                        </span>
                      )}
                    </div>

                    {/* Middle: Category pill + tags */}
                    <div className="mt-1 md:mt-0 md:flex-1 flex flex-wrap items-center gap-1.5">
                      <div className="flex items-center gap-2">
                        <CategoryControl
                          id={tx.id}
                          fingerprintInput={{
                            bookingDate: tx.bookingDate,
                            valueDate: tx.bookingDate,
                            amountCents: tx.amountCents,
                            currency: tx.currency,
                            purpose: tx.rawText,
                            counterpartName: tx.categoryExplanation?.merchantName ?? null,
                            accountIban: null,
                          }}
                          category={tx.category}
                          categorySource={tx.categorySource}
                          rawText={tx.rawText}
                          merchant={tx.categoryExplanation?.merchantName ?? null}
                          onApplied={async (_resolvedId, next) => {
                            const previousCategoryId = tx.category;
                            
                            // Update local state to reflect the change
                            setTransactions(prev =>
                              prev.map(t =>
                                t.id === tx.id ? { ...t, category: next, categorySource: 'user' } : t
                              )
                            );
                            
                            // If we successfully changed away from "Sonstiges", hide it from this queue
                            const isPreviouslyOther = !previousCategoryId || previousCategoryId === 'other';
                            const isNowOther = !next || next === 'other';
                            
                            if (isPreviouslyOther && !isNowOther) {
                              setHiddenTransactionIds(prev => {
                                const next = new Set(prev);
                                next.add(tx.id);
                                return next;
                              });
                            }
                          }}
                        />
                        {(() => {
                          const candidate = getSubscriptionCandidate(tx);
                          if (!candidate) return null;
                          return (
                            <button
                              type="button"
                              onClick={(e) => {
                                // Find the CategoryControl select element and set it to subscriptions
                                const button = e.currentTarget;
                                const row = button.closest('[data-transaction-id]');
                                if (row) {
                                  const select = row.querySelector('select') as HTMLSelectElement | null;
                                  if (select) {
                                    select.value = 'subscriptions';
                                    select.dispatchEvent(new Event('change', { bubbles: true }));
                                  }
                                }
                              }}
                              className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 transition hover:bg-indigo-100 hover:border-indigo-300 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
                              title={`Mögliches Abo: ${candidate.displayName} (${candidate.frequency === 'monthly' ? 'monatlich' : 'jährlich'})`}
                            >
                              Abo?
                            </button>
                          );
                        })()}
                      </div>
                      {/* Source tag */}
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                        source === 'rule' ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300' :
                        source === 'user' ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                        source === 'ml' ? 'bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' :
                        'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}>
                        {source === 'rule' && 'Regel'}
                        {source === 'user' && 'Manuell'}
                        {source === 'ml' && 'ML'}
                        {source === 'fallback' && 'Fallback'}
                        {source === 'unknown' && 'Unbekannt'}
                        {!['rule','user','ml','fallback','unknown'].includes(source) && source}
                      </span>
                    </div>

                    {/* Right: Confidence + Actions */}
                    <div className="flex items-center justify-between gap-2 md:flex-col md:items-end md:justify-center">
                      <div className="flex flex-col items-end gap-1.5">
                        {/* Amount (if available) */}
                        {amountCents !== undefined && amountCents !== 0 && (
                          <span
                            className={`text-sm md:text-base font-semibold tabular-nums ${
                              amountCents < 0
                                ? 'text-slate-900 dark:text-slate-50'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {amountCents < 0 ? '–' : '+'}{formatCurrency(Math.abs(amountCents) / 100)}
                          </span>
                        )}
                        
                        {/* Confidence indicator */}
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                isLow ? 'bg-red-400 dark:bg-red-500' : isMedium ? 'bg-yellow-400 dark:bg-yellow-500' : 'bg-green-400 dark:bg-green-500'
                              }`}
                              style={{ width: `${Math.round(confidence * 100)}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {Math.round(confidence * 100)}%
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap justify-end gap-1">
                        <WhyButton tx={tx} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
    </div>
    );
  })();

  return <AppShell>{content}</AppShell>;
}

function WhyButton({ tx }: { tx: ReviewTransaction }) {
  const explanation = tx.categoryExplanation;
  if (!explanation) {
    return (
      <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">
        Keine Details
      </span>
    );
  }

  return (
    <details className="group">
      <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 underline-offset-2 hover:underline list-none">
        Warum?
      </summary>
      <div className="mt-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 shadow-sm max-w-xs">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
          Regel
        </div>
        <div className="text-xs text-slate-800 dark:text-slate-200 mb-1">
          <span className="font-mono text-[11px] bg-slate-50 dark:bg-slate-900 px-1 py-0.5 rounded">
            {explanation.ruleId}
          </span>
        </div>
        {explanation.matchedText && (
          <div className="text-[11px] text-slate-600 dark:text-slate-300">
            <span className="font-semibold">Fundstelle:&nbsp;</span>
            {explanation.matchedText}
          </div>
        )}
      </div>
    </details>
  );
}
