import React, { useEffect, useMemo, useState } from 'react';
import { Link2 } from 'lucide-react';
import { AppShell } from '../layout/AppShell';
import { formatCurrency, formatDate } from '../lib/format';
import { CATEGORY_OPTIONS, getCategoryMeta } from '../lib/categories';

type ApiTransaction = {
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
  category?: string | null;
  categorySource?: string | null;
  categoryConfidence?: number | null;
  categoryRuleId?: string | null;
  isInternalTransfer?: boolean;
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

type DisplayTransaction = ApiTransaction & { displayId: string; linkedCount?: number };

const PAGE_SIZE = 25;

export const Transactions: React.FC = () => {
  const [items, setItems] = useState<ApiTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: '',
  });
  const [draftFilters, setDraftFilters] = useState({
    search: '',
    category: 'all',
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: '',
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
        setItems((json.transactions ?? []).map(tx => ({ ...tx, bookingDate: tx.bookingDate ?? tx.bookedAt ?? null })));
        setTotal(json.total ?? 0);
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
  }, [query]);

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  const handleFilterSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters(draftFilters);
    setPage(0);
  };

  const resetFilters = () => {
    const defaults = {
      search: '',
      category: 'all',
      startDate: '',
      endDate: '',
      minAmount: '',
      maxAmount: '',
    };
    setFilters(defaults);
    setDraftFilters(defaults);
    setPage(0);
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
    return results;
  }, [items]);

  return (
    <AppShell>
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Transaktionen</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Durchsuche und filtere deine importierten Buchungen.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200">
              {loading ? 'Lade…' : `${total.toLocaleString('de-DE')} Buchungen`}
            </span>
          </div>
          <form
            onSubmit={handleFilterSubmit}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900"
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

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-100/80 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Datum</th>
                  <th className="px-4 py-3 text-left font-semibold">Beschreibung</th>
                  <th className="px-4 py-3 text-left font-semibold">Kategorie</th>
                  <th className="px-4 py-3 text-right font-semibold">Betrag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700 dark:divide-slate-800 dark:text-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                      Lade Transaktionen…
                    </td>
                  </tr>
                ) : displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                      Keine Transaktionen gefunden.
                    </td>
                  </tr>
                ) : (
                  displayRows.map(tx => {
                    const meta = getCategoryMeta(tx.category ?? undefined);
                    const showInternal = Boolean(tx.isInternalTransfer || tx.transferLinkId);
                    const rawMeta = (tx.metadata ?? undefined) as Record<string, unknown> | undefined;
                    const reason =
                      rawMeta && typeof rawMeta.paypalCategoryReason === 'string' ? (rawMeta.paypalCategoryReason as string) : null;
                    const transferReasons =
                      rawMeta && Array.isArray(rawMeta.transferReasons)
                        ? (rawMeta.transferReasons as string[])
                        : rawMeta && typeof rawMeta.transferReasons === 'string'
                        ? (rawMeta.transferReasons as string).split(',').filter(Boolean)
                        : null;
                    return (
                      <tr key={tx.displayId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3">{formatDate(tx.bookingDate ?? undefined)}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {tx.payee || tx.counterpart || tx.purpose || '—'}
                          </div>
                          {tx.memo && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">{tx.memo}</div>
                          )}
                          {reason ? (
                            <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                              Regel:&nbsp;{reason}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-medium"
                            style={{ backgroundColor: meta.background, color: meta.color }}
                          >
                            {showInternal ? <Link2 className="h-3 w-3" /> : null}
                            {meta.label}
                          </span>
                          {showInternal ? (
                            <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                              Interner Transfer
                              {tx.linkedCount && tx.linkedCount > 1 ? ` · ${tx.linkedCount} Buchungen` : ''}
                              {transferReasons && transferReasons.length
                                ? ` · ${transferReasons.join(', ')}`
                                : ''}
                            </div>
                          ) : null}
                        </td>
                        <td
                          className={`px-4 py-3 text-right text-sm font-semibold ${
                            tx.amount < 0 ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300'
                          }`}
                        >
                          {formatCurrency(tx.amount)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPage(prev => Math.max(prev - 1, 0))}
            disabled={page === 0 || loading}
            className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
          >
            Zurück
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Seite {page + 1} von {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(prev => (prev + 1 < totalPages ? prev + 1 : prev))}
            disabled={page + 1 >= totalPages || loading}
            className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
          >
            Weiter
          </button>
        </div>
      </section>
    </AppShell>
  );
};

export default Transactions;

