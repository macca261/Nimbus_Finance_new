import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '../layout/AppShell';
import { formatCurrency } from '../lib/format';
import { CATEGORY_OPTIONS } from '../lib/categories';
import { UserRulesPanel } from '../components/UserRulesPanel';
import { TransactionsHeaderStrip } from '../components/transactions/TransactionsHeaderStrip';
import { TransactionCard } from '../components/transactions/TransactionCard';
import { DraggableTransactionCard } from '../components/transactions/DraggableTransactionCard';
import { groupTransactionsByDate } from '../lib/dateGrouping';

export type ApiTransaction = {
  id: number;
  bookingDate: string | null;
  bookedAt?: string | null;
  valueDate?: string | null;
  amount: number;
  amountCents?: number;
  currency: string;
  direction?: string | null;
  payee?: string | null;
  counterpart?: string | null;
  counterpartyIban?: string | null;
  purpose?: string | null;
  memo?: string | null;
  displayName?: string; // Human-friendly short name (computed from payee/counterpartName/purpose/memo)
  rawText?: string; // Full raw booking text (for detail views)
  category?: string | null;
  categorySource?: string | null;
  categoryConfidence?: number | null;
  categoryRuleId?: string | null;
  categorizationReasonCode?: string;
  categorizationReasonText?: string;
  isInternalTransfer?: boolean;
  isPassThrough?: boolean;
  passThroughGroupId?: string | null;
  internalTransferKind?: 'savings' | 'wallet' | 'other' | 'payment_provider_funding' | null;
  internalTransferDirection?: 'in' | 'out' | null;
  isRefund?: boolean;
  isRefunded?: boolean;
  isReimbursement?: boolean;
  reimbursementRole?: 'payer' | 'receiver' | null;
  reimbursementGroupId?: string | null;
  isCashWithdrawal?: boolean;
  transferLinkId?: string | null;
  source?: string | null;
  sourceProfile?: string | null;
  metadata?: Record<string, unknown> | null;
};

type TransactionResponse = {
  ok: boolean;
  total: number;
  transactions: ApiTransaction[];
};

export type DisplayTransaction = ApiTransaction & { displayId: string; linkedCount?: number };

const PAGE_SIZE = 50; // Increased from 25 for better UX - users see more transactions at once

export const Transactions: React.FC = () => {
  const navigate = useNavigate();
  
  // Read initial filters from URL (only on first mount)
  const useTransactionUrlFilters = () => {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const initialCategory = params.get('category') ?? undefined;
    const initialOnlyOther = params.get('onlyOther') === '1';
    const initialReview = (params.get('review') as 'uncategorized' | 'low-confidence' | null) ?? null;
    const initialFrom = params.get('from') ?? undefined;
    const initialTo = params.get('to') ?? undefined;
    const initialAccountId = params.get('accountId') ?? undefined;
    return {
      initialCategory,
      initialOnlyOther,
      initialReview,
      initialFrom,
      initialTo,
      initialAccountId,
    };
  };

  const {
    initialCategory,
    initialOnlyOther,
    initialReview,
    initialFrom,
    initialTo,
    // initialAccountId, // Reserved for future account filter wiring
  } = useTransactionUrlFilters();

  const [items, setItems] = useState<ApiTransaction[]>([]);
  const [total, setTotal] = useState(0);
  
  // Read initial page from URL (default to 0)
  const location = useLocation();
  const initialPage = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const pageParam = params.get('page');
    return pageParam ? Math.max(0, parseInt(pageParam, 10)) : 0;
  }, [location.search]);
  
  const [page, setPage] = useState(initialPage);
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set([initialPage])); // Track which pages have been loaded
  const [hasMore, setHasMore] = useState(false); // Track if there are more items to load
  
  // Sync page state with URL when it changes externally (e.g., browser back/forward)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const pageParam = params.get('page');
    const urlPage = pageParam ? Math.max(0, parseInt(pageParam, 10)) : 0;
    if (urlPage !== page) {
      setPage(urlPage);
      setLoadedPages(new Set([urlPage]));
      setItems([]); // Clear items to trigger reload
    }
  }, [location.search, page]);
  const [showRulesPanel, setShowRulesPanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  // Review mode derived from initial URL: low-confidence filter
  const [lowConfidenceReview, setLowConfidenceReview] = useState<boolean>(initialReview === 'low-confidence');
  const [filters, setFilters] = useState({
    search: '',
    category: initialCategory ?? 'all',
    startDate: initialFrom ?? '',
    endDate: initialTo ?? '',
    minAmount: '',
    maxAmount: '',
    // Treat review=uncategorized as "Nur Sonstiges anzeigen"
    showOnlyOther: initialReview === 'uncategorized' ? true : initialOnlyOther,
  });
  const [draftFilters, setDraftFilters] = useState({
    search: '',
    category: initialCategory ?? 'all',
    startDate: initialFrom ?? '',
    endDate: initialTo ?? '',
    minAmount: '',
    maxAmount: '',
    showOnlyOther: initialReview === 'uncategorized' ? true : initialOnlyOther,
  });

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', PAGE_SIZE.toString());
    params.set('offset', (page * PAGE_SIZE).toString());
    if (filters.search.trim()) params.set('search', filters.search.trim());
    if (filters.category !== 'all') params.set('category', filters.category);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.minAmount) params.set('minAmount', filters.minAmount);
    if (filters.maxAmount) params.set('maxAmount', filters.maxAmount);
    return params.toString();
  }, [filters, page]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/transactions?${query}`, { signal: controller.signal });
        if (!res.ok) {
          throw new Error('Transaktionen konnten nicht geladen werden.');
        }
        const json = (await res.json()) as TransactionResponse;
        const newItems = (json.transactions ?? []).map(tx => ({ ...tx, bookingDate: tx.bookingDate ?? tx.bookedAt ?? null }));
        
        // For pagination: always replace items for the current page
        // This ensures we show the correct page when navigating via URL
        setItems(newItems);
        setLoadedPages(prev => new Set([...prev, page]));
        
        setTotal(json.total ?? 0);
        // Check if there are more items to load
        setHasMore((page + 1) * PAGE_SIZE < (json.total ?? 0));
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        setError(err?.message || 'Transaktionen konnten nicht geladen werden.');
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [query, page]);

  // Helper to reload current page
  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/transactions?${query}`);
      if (!res.ok) throw new Error('Transaktionen konnten nicht geladen werden.');
      const json = (await res.json()) as TransactionResponse;
      setItems((json.transactions ?? []).map(tx => ({ ...tx, bookingDate: tx.bookingDate ?? tx.bookedAt ?? null })));
      setTotal(json.total ?? 0);
    } catch (e: any) {
      setError(e?.message || 'Transaktionen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  const handleFilterSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters(draftFilters);
    setPage(0);
    setLoadedPages(new Set([0]));
    setItems([]); // Clear items when filters change
    // Update URL to reflect page reset
    const params = new URLSearchParams(location.search);
    params.delete('page');
    navigate(`/transactions?${params.toString()}`, { replace: true });
  };

  const resetFilters = () => {
    const defaults = {
      search: '',
      category: 'all',
      startDate: '',
      endDate: '',
      minAmount: '',
      maxAmount: '',
      showOnlyOther: false,
    };
    setFilters(defaults);
    setDraftFilters(defaults);
    setPage(0);
    setLoadedPages(new Set([0]));
    setItems([]); // Clear items when filters change
    // Update URL to reflect reset
    navigate('/transactions', { replace: true });
  };

  const displayRows: DisplayTransaction[] = useMemo(() => {
    const grouped = new Map<string, ApiTransaction[]>();
    const results: DisplayTransaction[] = [];
    for (const tx of items) {
      if (tx.transferLinkId) {
        const arr = grouped.get(tx.transferLinkId) ?? [];
        arr.push(tx);
        grouped.set(tx.transferLinkId, arr);
      }
    }
    const seenLinks = new Set<string>();
    for (const tx of items) {
      if (!tx.transferLinkId) {
        results.push({ ...tx, displayId: `tx-${tx.id}` });
        continue;
      }
      if (seenLinks.has(tx.transferLinkId)) continue;
      seenLinks.add(tx.transferLinkId);
      const group = grouped.get(tx.transferLinkId) ?? [tx];
      const primary = group.find(item => item.amount < 0) ?? group[0];
      results.push({
        ...primary,
        displayId: `link-${tx.transferLinkId}`,
        linkedCount: group.length,
      });
    }
    
    // Apply "showOnlyOther" filter
    // Cash withdrawals and internal transfers are never treated as Sonstiges
    function isSonstiges(tx: ApiTransaction): boolean {
      // Only treat as Sonstiges if:
      // - legacy category is 'other' or 'other_review'
      // - and it is NOT a cash withdrawal
      // - and NOT an internal transfer
      // - and NOT a reimbursement
      if (tx.isCashWithdrawal) return false;
      if (tx.isInternalTransfer) return false;
      if (tx.isReimbursement) return false;
      return tx.category === 'other' || tx.category === 'other_review';
    }
    
    let out = results;
    if (filters.showOnlyOther) {
      out = out.filter(tx => isSonstiges(tx));
    }
    // Apply low-confidence review filter if enabled from URL on initial mount
    if (lowConfidenceReview) {
      out = out.filter(tx => {
        const c = typeof tx.categoryConfidence === 'number' ? tx.categoryConfidence : null;
        return c !== null && c < 0.4;
      });
    }
    return out;
  }, [items, filters.showOnlyOther, lowConfidenceReview]);

  // Group transactions by date for feed-style display
  const dateGroups = useMemo(() => {
    return groupTransactionsByDate(displayRows);
  }, [displayRows]);
  
  const otherCount = useMemo(() => {
    // Count only actual Sonstiges (exclude cash withdrawals and internal transfers)
    function isSonstiges(tx: ApiTransaction): boolean {
      if (tx.isCashWithdrawal) return false;
      if (tx.isInternalTransfer) return false;
      if (tx.isReimbursement) return false;
      return tx.category === 'other' || tx.category === 'other_review';
    }
    return items.filter(tx => isSonstiges(tx)).length;
  }, [items]);

  const handleOverrideApplied = useCallback(
    (txId: number, nextCategory: string | null) => {
      setItems(prev =>
        prev.map(item =>
          item.id === txId
            ? {
                ...item,
                category: nextCategory ?? null,
                categorySource: nextCategory ? 'user' : null,
              }
            : item,
        ),
      );
    },
    [],
  );

  // Selection helpers and pass-through predicates
  const toggleSelected = useCallback((id: number, checked: boolean) => {
    setSelectedIds(prev => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter(x => x !== id);
    });
  }, []);

  const selectedTxs = useMemo(() => {
    const set = new Set(selectedIds);
    return items.filter(tx => set.has(tx.id));
  }, [selectedIds, items]);

  const canMarkPassThrough = useMemo(() => {
    if (selectedTxs.length !== 2) return false;
    const [a, b] = selectedTxs;
    const aC = typeof a.amountCents === 'number' ? a.amountCents : Math.round(a.amount * 100);
    const bC = typeof b.amountCents === 'number' ? b.amountCents : Math.round(b.amount * 100);
    const oppositeSign = (aC < 0 && bC > 0) || (aC > 0 && bC < 0);
    const diff = Math.abs(Math.abs(aC) - Math.abs(bC));
    return oppositeSign && diff <= 100;
  }, [selectedTxs]);

  const canRemovePassThrough = useMemo(() => {
    if (selectedTxs.length < 1) return false;
    return selectedTxs.every(tx => Boolean(tx.isPassThrough));
  }, [selectedTxs]);

  const markAsPassThrough = useCallback(async () => {
    const ids = selectedIds.slice(0, 2);
    try {
      if (ids.length !== 2) return;
      const res = await fetch('/api/transactions/pass-through', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds: ids }),
      });
      if (!res.ok) throw new Error('Konnte Durchlaufposten nicht setzen');
      await reload();
    } catch {
      setError('Konnte Durchlaufposten nicht setzen – bitte prüfe Betrag und Auswahl.');
    } finally {
      setSelectedIds([]);
    }
  }, [selectedIds, reload]);

  const removePassThrough = useCallback(async () => {
    const ids = selectedIds.slice();
    try {
      if (ids.length < 1) return;
      const res = await fetch('/api/transactions/pass-through/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds: ids }),
      });
      if (!res.ok) throw new Error('Konnte Durchlaufposten nicht entfernen');
      await reload();
    } catch {
      setError('Konnte Durchlaufposten nicht entfernen.');
    } finally {
      setSelectedIds([]);
    }
  }, [selectedIds, reload]);

  const handleTimeFilterChange = useCallback((days: number | 'all') => {
    if (days === 'all') {
      const thisYear = new Date().getFullYear();
      setFilters(prev => ({
        ...prev,
        startDate: `${thisYear}-01-01`,
        endDate: '',
      }));
      setDraftFilters(prev => ({
        ...prev,
        startDate: `${thisYear}-01-01`,
        endDate: '',
      }));
    } else {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      setFilters(prev => ({
        ...prev,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      }));
      setDraftFilters(prev => ({
        ...prev,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      }));
    }
    setPage(0);
    setLoadedPages(new Set([0]));
    setItems([]); // Clear items when filters change
    // Update URL to reflect page reset
    const params = new URLSearchParams(location.search);
    params.delete('page');
    navigate(`/transactions?${params.toString()}`, { replace: true });
  }, [location.search, navigate]);

  return (
    <AppShell>
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 rounded-3xl border border-nf-border-subtle bg-nf-bg-card px-5 py-5 shadow-elevated">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-nf-text-main">Transaktionen</h1>
              <p className="text-sm text-nf-text-muted">
                Durchsuche und filtere deine importierten Buchungen.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200">
                {loading ? 'Lade…' : `${total.toLocaleString('de-DE')} Buchungen`}
              </span>
              <button
                onClick={() => setShowRulesPanel(true)}
                className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                Eigene Regeln verwalten
              </button>
            </div>
          </div>
          <form
            onSubmit={handleFilterSubmit}
            className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-5 shadow-card"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Suchtext
                <input
                  type="text"
                  value={draftFilters.search}
                  onChange={event => setDraftFilters(prev => ({ ...prev, search: event.target.value }))}
                  placeholder="Beschreibung, Gegenpartei…"
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-300 dark:focus:ring-indigo-500/30"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Kategorie
                <select
                  value={draftFilters.category}
                  onChange={event => setDraftFilters(prev => ({ ...prev, category: event.target.value }))}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-300 dark:focus:ring-indigo-500/30"
                >
                  <option value="all">Alle Kategorien</option>
                  {CATEGORY_OPTIONS.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Von
                <input
                  type="date"
                  value={draftFilters.startDate}
                  onChange={event => setDraftFilters(prev => ({ ...prev, startDate: event.target.value }))}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-300 dark:focus:ring-indigo-500/30"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Bis
                <input
                  type="date"
                  value={draftFilters.endDate}
                  onChange={event => setDraftFilters(prev => ({ ...prev, endDate: event.target.value }))}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-300 dark:focus:ring-indigo-500/30"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Mindestbetrag (€)
                <input
                  type="number"
                  inputMode="decimal"
                  value={draftFilters.minAmount}
                  onChange={event => setDraftFilters(prev => ({ ...prev, minAmount: event.target.value }))}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-300 dark:focus:ring-indigo-500/30"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Maximalbetrag (€)
                <input
                  type="number"
                  inputMode="decimal"
                  value={draftFilters.maxAmount}
                  onChange={event => setDraftFilters(prev => ({ ...prev, maxAmount: event.target.value }))}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-300 dark:focus:ring-indigo-500/30"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus:ring-indigo-500/40"
              >
                Filter anwenden
              </button>
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white dark:focus:ring-indigo-500/30"
              >
                Zurücksetzen
              </button>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.showOnlyOther}
                  onChange={event => {
                    setFilters(prev => ({ ...prev, showOnlyOther: event.target.checked }));
                    setDraftFilters(prev => ({ ...prev, showOnlyOther: event.target.checked }));
                  }}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-200 dark:border-slate-600 dark:focus:ring-indigo-500/30"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Nur 'Sonstiges' anzeigen
                  {otherCount > 0 && (
                    <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                      ({otherCount})
                    </span>
                  )}
                </span>
              </label>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {loading ? 'Lade Daten…' : `${total.toLocaleString('de-DE')} Ergebnisse`}
              </span>
            </div>
          </form>
        </div>

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        {/* Header Strip */}
        <TransactionsHeaderStrip
          transactions={displayRows}
          total={total}
          filters={{
            startDate: filters.startDate,
            endDate: filters.endDate,
            category: filters.category,
          }}
          onTimeFilterChange={handleTimeFilterChange}
          loading={loading}
        />

        {/* Low confidence review banner */}
        {lowConfidenceReview && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30">
            Niedrige Confidence – zeige nur Buchungen mit geringer Zuverlässigkeit der Kategorie.
          </div>
        )}

        {/* Transaction Feed */}
        <div className="space-y-6">
          {loading ? (
            <div className="rounded-2xl border border-nf-border-subtle bg-nf-bg-card px-6 py-12 text-center text-nf-text-muted">
              Lade Transaktionen…
            </div>
          ) : dateGroups.length === 0 ? (
            <div className="rounded-2xl border border-nf-border-subtle bg-nf-bg-card px-6 py-12 text-center text-nf-text-muted">
              Keine Transaktionen gefunden.
            </div>
          ) : (
            dateGroups.map(group => (
              <div key={group.dateKey} className="space-y-2">
                {/* Date Header */}
                <div className="flex items-center justify-between px-1 py-2 sticky top-0 bg-nf-bg-shell/80 backdrop-blur-sm z-10">
                  <div className="text-xs font-semibold uppercase tracking-wide text-nf-text-muted">
                    {group.label}
                  </div>
                  <div className="text-[11px] text-nf-text-soft">
                    {group.transactions.length} Buchung{group.transactions.length !== 1 ? 'en' : ''} ·{' '}
                    {formatCurrency(group.netto)} netto
                  </div>
                </div>

                {/* Transaction Cards */}
                <div className="space-y-2">
                  {group.transactions.map(tx => (
                    <DraggableTransactionCard
                      key={tx.displayId}
                      transaction={tx}
                      isSelected={selectedIds.includes(tx.id)}
                      onSelect={toggleSelected}
                      onCategoryChange={handleOverrideApplied}
                      onNavigate={tx => {
                        // Navigate to transaction detail if available, or keep current behavior
                        if (tx.reimbursementGroupId) {
                          navigate(`/review?focusReimbursementGroup=${encodeURIComponent(tx.reimbursementGroupId)}`);
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination / Load More */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Page info and back button (if not on first page) */}
          <div className="flex items-center gap-3">
            {page > 0 && (
              <button
                type="button"
                onClick={() => {
                  const newPage = Math.max(page - 1, 0);
                  // Scroll to top when going back
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  setPage(newPage);
                  // Update URL
                  const params = new URLSearchParams(location.search);
                  if (newPage === 0) {
                    params.delete('page');
                  } else {
                    params.set('page', newPage.toString());
                  }
                  navigate(`/transactions?${params.toString()}`, { replace: true });
                }}
                disabled={loading}
                className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
              >
                Zurück
              </button>
            )}
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {items.length} von {total} Buchungen
              {totalPages > 1 && ` · Seite ${page + 1} von ${totalPages}`}
            </span>
          </div>

          {/* Right: Load More button */}
          {hasMore && (
            <button
              type="button"
              onClick={() => {
                const newPage = page + 1;
                setPage(newPage);
                // Update URL
                const params = new URLSearchParams(location.search);
                params.set('page', newPage.toString());
                navigate(`/transactions?${params.toString()}`, { replace: true });
              }}
              disabled={loading}
              className="rounded-full border border-nf-primary bg-nf-primary px-4 py-1.5 text-sm font-medium text-white transition hover:bg-nf-primary/90 hover:shadow-glow-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Lade...' : 'Weitere laden'}
            </button>
          )}
        </div>
      </section>
      {showRulesPanel && <UserRulesPanel onClose={() => setShowRulesPanel(false)} />}
    </AppShell>
  );
};

export default Transactions;

