import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../layout/AppShell';
import { toast } from '../lib/toast';
import { formatCurrency, formatPercent, formatDate } from '../lib/format';
import CategoryControl from '../components/CategoryControl';
import { getCategoryLabel } from '../lib/categories';

type Group = {
  groupId: string;
  displayName: string;
  txCount: number;
  totalExpenseCents: number;
  lastDate: string;
  exampleTransactionId: string;
  suggestedCategoryId: string | null;
  suggestedNimbusCategoryId: string | null;
  suggestedConfidence: number | null;
  suggestedReasonText: string | null;
};
type Summary = {
  totalSonstigesCents: number;
  groups: Group[];
};

type TransactionPreview = {
  id: string;
  bookingDate: string;
  amountCents: number;
  description: string;
  currentCategoryId: string | null;
  categorySource: string | null;
};

type PreviewData = {
  transactions: TransactionPreview[];
  totalCount: number;
  totalExpenseCents: number;
};

export default function SonstigesCleanupPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workingGroupId, setWorkingGroupId] = useState<string | null>(null);
  const [categoryByGroup, setCategoryByGroup] = useState<Record<string, string>>({});
  const [saveRuleByGroup, setSaveRuleByGroup] = useState<Record<string, boolean>>({});
  const [applyPastByGroup, setApplyPastByGroup] = useState<Record<string, boolean>>({});
  const [previews, setPreviews] = useState<Record<string, PreviewData>>({});
  const [loadingPreview, setLoadingPreview] = useState<Record<string, boolean>>({});
  const [totalExpensesCents, setTotalExpensesCents] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadTotalExpenses = async () => {
      try {
        const res = await fetch('/api/summary/categories');
        if (!res.ok) return;
        const json = await res.json();
        const catRows: Array<{ category: string; rawExpenseCents: number }> = json?.data ?? [];
        const total = catRows.reduce((sum, r) => {
          // Exclude income categories and internal transfers
          if (r.category?.startsWith('income_')) return sum;
          return sum + (r.rawExpenseCents || 0);
        }, 0);
        if (!cancelled) setTotalExpensesCents(total);
      } catch (e) {
        // Silently fail - percentage is optional
      }
    };
    void loadTotalExpenses();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadPreview = async (groupId: string) => {
    setLoadingPreview(prev => {
      if (prev[groupId]) return prev;
      return { ...prev, [groupId]: true };
    });
    try {
      const res = await fetch(`/api/review/sonstiges/group/${encodeURIComponent(groupId)}/transactions?limit=5`);
      if (!res.ok) throw new Error('Vorschau konnte nicht geladen werden.');
      const json = await res.json();
      setPreviews(prev => ({ ...prev, [groupId]: json }));
    } catch (e: any) {
      toast(e?.message || 'Vorschau konnte nicht geladen werden.', 'error');
    } finally {
      setLoadingPreview(prev => ({ ...prev, [groupId]: false }));
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/review/sonstiges-summary?days=90');
        if (!res.ok) throw new Error('Zusammenfassung konnte nicht geladen werden.');
        const json = (await res.json()) as Summary;
        if (!cancelled) {
          const sortedGroups = (json.groups || []).sort((a, b) => b.totalExpenseCents - a.totalExpenseCents);
          setSummary({
            totalSonstigesCents: json.totalSonstigesCents || 0,
            groups: sortedGroups,
          });
          
          // Pre-fill categories with suggestions where available
          const initialCategories: Record<string, string> = {};
          sortedGroups.forEach(g => {
            if (g.suggestedCategoryId && g.suggestedCategoryId.trim()) {
              initialCategories[g.groupId] = g.suggestedCategoryId;
            }
          });
          setCategoryByGroup(initialCategories);
          
          // Load previews for all groups automatically
          sortedGroups.forEach(g => {
            void loadPreview(g.groupId);
          });
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Zusammenfassung konnte nicht geladen werden.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleApply = useCallback(async (g: Group, overrideCategoryId?: string) => {
    const categoryId = overrideCategoryId || categoryByGroup[g.groupId];
    if (!categoryId || !categoryId.trim()) {
      toast('Bitte zuerst eine Kategorie wählen.', 'error');
      return;
    }

    setWorkingGroupId(g.groupId);
    try {
      const res = await fetch('/api/review/sonstiges/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: g.groupId,
          categoryId: categoryId,
          createRule: Boolean(saveRuleByGroup[g.groupId] ?? true),
          applyToPast: Boolean(applyPastByGroup[g.groupId] ?? true),
        }),
      });
      if (res.status === 409) {
        const conflict = await res.json();
        const message = conflict?.error === 'rule_conflict'
          ? 'Für diesen Händler existiert bereits eine Regel. Bitte passe die bestehende Regel an.'
          : conflict?.message || 'Fehler beim Speichern. Bitte versuche es erneut.';
        toast(message, 'error');
        return;
      }
      if (!res.ok) throw new Error('Fehler beim Speichern. Bitte versuche es erneut.');
      const categoryLabel = getCategoryLabel(categoryId);
      toast(`Buchungen von «${g.displayName}» wurden als «${categoryLabel}» kategorisiert.`, 'success');
      // Remove group locally and update total
      setSummary(prev => {
        if (!prev) return prev;
        const remaining = prev.groups.filter(x => x.groupId !== g.groupId);
        const removedGroup = prev.groups.find(x => x.groupId === g.groupId);
        return {
          totalSonstigesCents: Math.max(0, (prev.totalSonstigesCents || 0) - (removedGroup?.totalExpenseCents || 0)),
          groups: remaining,
        };
      });
      // Clean up state
      const newCategoryByGroup = { ...categoryByGroup };
      delete newCategoryByGroup[g.groupId];
      setCategoryByGroup(newCategoryByGroup);
      const newSaveRuleByGroup = { ...saveRuleByGroup };
      delete newSaveRuleByGroup[g.groupId];
      setSaveRuleByGroup(newSaveRuleByGroup);
      const newApplyPastByGroup = { ...applyPastByGroup };
      delete newApplyPastByGroup[g.groupId];
      setApplyPastByGroup(newApplyPastByGroup);
      const newPreviews = { ...previews };
      delete newPreviews[g.groupId];
      setPreviews(newPreviews);
    } catch (e: any) {
      toast(e?.message || 'Fehler beim Speichern. Bitte versuche es erneut.', 'error');
    } finally {
      setWorkingGroupId(null);
    }
  }, [categoryByGroup, saveRuleByGroup, applyPastByGroup, previews]);

  // Calculate percentage for header
  const percentage = useMemo(() => {
    if (!summary || summary.totalSonstigesCents === 0 || !totalExpensesCents || totalExpensesCents === 0) return 0;
    return (summary.totalSonstigesCents / totalExpensesCents) * 100;
  }, [summary, totalExpensesCents]);

  const header = useMemo(() => {
    const total = summary?.totalSonstigesCents || 0;
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4">
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">Sonstiges bereinigen</h1>
          {total > 0 ? (
            <p className="mt-2 text-base text-slate-600 dark:text-slate-400">
              Aktuell sind {percentage.toFixed(1)}% deiner Ausgaben als 'Sonstiges' kategorisiert.
            </p>
          ) : (
            <p className="mt-2 text-base text-slate-600 dark:text-slate-400">
              Glückwunsch – aktuell hast du keine 'Sonstiges'-Ausgaben.
            </p>
          )}
        </div>
        {total > 0 && (
          <div className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
            {formatCurrency(total / 100)}
          </div>
        )}
      </div>
    );
  }, [summary, percentage]);

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm text-slate-500 dark:text-slate-400">Lade Zusammenfassung…</div>
        </div>
      );
    }
    if (error) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm text-rose-600 dark:text-rose-400">{error}</div>
        </div>
      );
    }
    const groups = summary?.groups || [];
    if (groups.length === 0) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Aktuell gibt es keine offenen 'Sonstiges'-Händler. Super!
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-4 md:space-y-6">
        {groups.map(g => {
          const preview = previews[g.groupId];
          const previewLoading = loadingPreview[g.groupId];
          const selectedCategory = categoryByGroup[g.groupId];
          const isWorking = workingGroupId === g.groupId;
          const canApply = selectedCategory && selectedCategory.trim() && !isWorking;

          return (
            <div
              key={g.groupId}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              {/* Merchant header */}
              <div className="mb-4">
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50">{g.displayName}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {g.txCount} Buchungen · {formatCurrency(g.totalExpenseCents / 100)} · letzte Buchung:{' '}
                  {formatDate(g.lastDate)}
                </p>
              </div>

              {/* Sample transactions */}
              {previewLoading ? (
                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Lade Beispielbuchungen…</div>
                </div>
              ) : preview ? (
                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                  <div className="space-y-2">
                    {preview.transactions.map(tx => (
                      <div
                        key={tx.id}
                        className="flex items-start justify-between gap-2 text-xs text-slate-700 dark:text-slate-300"
                      >
                        <div className="flex-1 truncate">
                          <span className="text-slate-500 dark:text-slate-400">{formatDate(tx.bookingDate)}</span>
                          {' · '}
                          <span className="truncate">{tx.description || '—'}</span>
                        </div>
                        <span className="shrink-0 font-medium">
                          {formatCurrency(tx.amountCents / 100)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Category selection */}
              <div className="mb-4 w-full">
                <CategoryControl
                  id={g.exampleTransactionId}
                  fingerprintInput={undefined}
                  category={selectedCategory}
                  categorySource={'user'}
                  rawText={g.displayName}
                  merchant={g.displayName}
                  onApplied={(_id, next) => {
                    setCategoryByGroup(prev => ({ ...prev, [g.groupId]: next || '' }));
                  }}
                />
              </div>

              {/* Toggles */}
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={saveRuleByGroup[g.groupId] ?? true}
                    onChange={e => setSaveRuleByGroup(prev => ({ ...prev, [g.groupId]: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200 dark:border-slate-600 dark:focus:ring-indigo-500/30"
                  />
                  <span>Regel speichern</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={applyPastByGroup[g.groupId] ?? true}
                    onChange={e => setApplyPastByGroup(prev => ({ ...prev, [g.groupId]: e.target.checked }))}
                    disabled={!(saveRuleByGroup[g.groupId] ?? true)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:focus:ring-indigo-500/30"
                  />
                  <span>Auf vergangene Buchungen anwenden</span>
                </label>
              </div>

              {/* Apply button and link */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <a
                  href={`/transactions?category=other&search=${encodeURIComponent(g.displayName)}`}
                  className="text-sm text-indigo-600 hover:underline dark:text-indigo-400 sm:text-left"
                >
                  In Transaktionen ansehen
                </a>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {g.suggestedCategoryId && g.suggestedCategoryId.trim() && (
                    <button
                      onClick={() => {
                        // Apply with suggested category, respecting toggles
                        void handleApply(g, g.suggestedCategoryId!);
                      }}
                      disabled={isWorking}
                      className="w-full rounded-full border border-indigo-600 bg-white px-6 py-2.5 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-400 dark:bg-slate-800 dark:text-indigo-400 dark:hover:bg-slate-700 sm:w-auto"
                    >
                      {isWorking ? 'Übernehme…' : 'Empfehlung übernehmen'}
                    </button>
                  )}
                  <button
                    onClick={() => void handleApply(g)}
                    disabled={!canApply}
                    className={`w-full rounded-full px-6 py-2.5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${
                      g.suggestedCategoryId && g.suggestedCategoryId.trim()
                        ? 'bg-slate-600 hover:bg-slate-500 dark:bg-slate-700 dark:hover:bg-slate-600'
                        : 'bg-indigo-600 hover:bg-indigo-500'
                    }`}
                  >
                    {isWorking ? 'Übernehme…' : 'Übernehmen & weiter'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }, [
    loading,
    error,
    summary,
    categoryByGroup,
    workingGroupId,
    saveRuleByGroup,
    applyPastByGroup,
    previews,
    loadingPreview,
    handleApply,
    navigate,
  ]);

  return (
    <AppShell>
      <div className="flex flex-col gap-4 md:gap-6">
        {header}
        {content}
      </div>
    </AppShell>
  );
}


