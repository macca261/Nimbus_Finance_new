import React, { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../layout/AppShell';
import { toast } from '../lib/toast';
import { formatCurrency } from '../lib/format';
import CategoryControl from '../components/CategoryControl';

type Group = {
  groupId: string;
  displayName: string;
  txCount: number;
  totalExpenseCents: number;
  lastDate: string;
  exampleTransactionId: string;
};
type Summary = {
  totalSonstigesCents: number;
  groups: Group[];
};

export default function SonstigesCleanupPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workingGroupId, setWorkingGroupId] = useState<string | null>(null);
  const [categoryByGroup, setCategoryByGroup] = useState<Record<string, string>>({});
  const [saveRuleByGroup, setSaveRuleByGroup] = useState<Record<string, boolean>>({});
  const [applyPastByGroup, setApplyPastByGroup] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [previews, setPreviews] = useState<Record<string, { transactions: Array<{ id: string; bookingDate: string; amountCents: number; description: string; currentCategoryId: string | null; categorySource: string | null }>; totalCount: number; totalExpenseCents: number }>>({});
  const [loadingPreview, setLoadingPreview] = useState<Record<string, boolean>>({});
  const [confirmGroup, setConfirmGroup] = useState<Group | null>(null);

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
          setSummary({
            totalSonstigesCents: json.totalSonstigesCents || 0,
            groups: (json.groups || []).sort((a, b) => b.totalExpenseCents - a.totalExpenseCents),
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

  const handleApply = async (g: Group) => {
    const categoryId = categoryByGroup[g.groupId];
    if (!categoryId || !categoryId.trim()) {
      toast('Bitte zuerst eine Kategorie wählen.', 'error');
      return;
    }
    setConfirmGroup(g);
  };

  const header = useMemo(() => {
    const total = summary?.totalSonstigesCents || 0;
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Sonstiges aufräumen</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sonstiges im Zeitraum: {formatCurrency((total || 0) / 100)}
            </p>
          </div>
          <a
            href="/transactions?review=uncategorized"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
          >
            Zu den Buchungen
          </a>
        </div>
      </div>
    );
  }, [summary]);

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
          <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">Kein Sonstiges zu bereinigen. 🎉</div>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Alles aufgeräumt – weiter so!
          </div>
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-0 shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
            <tr className="text-left">
              <th className="px-4 py-3">Händler / Beschreibung</th>
              <th className="px-4 py-3">Buchungen</th>
              <th className="px-4 py-3">Summe</th>
              <th className="px-4 py-3">Letzte Buchung</th>
              <th className="px-4 py-3">Aktion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {groups.map(g => (
              <tr key={g.groupId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800 dark:text-slate-100">{g.displayName}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Gruppe: {g.groupId}</div>
                  {expanded[g.groupId] && (
                    <div className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                      {loadingPreview[g.groupId] ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400">Lade Beispielbuchungen…</div>
                      ) : previews[g.groupId] ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-12 text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                            <div className="col-span-3">Datum</div>
                            <div className="col-span-3">Betrag</div>
                            <div className="col-span-4">Beschreibung</div>
                            <div className="col-span-2">Aktuelle Kategorie</div>
                          </div>
                          {previews[g.groupId].transactions.map(tx => (
                            <div key={tx.id} className="grid grid-cols-12 text-xs text-slate-700 dark:text-slate-300">
                              <div className="col-span-3">{tx.bookingDate}</div>
                              <div className="col-span-3">{(tx.amountCents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</div>
                              <div className="col-span-4">{tx.description || '—'}</div>
                              <div className="col-span-2">{tx.currentCategoryId || 'other'}</div>
                            </div>
                          ))}
                          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            Insgesamt {previews[g.groupId].totalCount} Buchungen, {(previews[g.groupId].totalExpenseCents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">{g.txCount}</td>
                <td className="px-4 py-3">{formatCurrency((g.totalExpenseCents || 0) / 100)}</td>
                <td className="px-4 py-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400">{g.lastDate}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-2">
                    <div>
                      <button
                        type="button"
                        className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                        onClick={async () => {
                          const next = !(expanded[g.groupId] ?? false);
                          setExpanded(prev => ({ ...prev, [g.groupId]: next }));
                          if (next && !previews[g.groupId]) {
                            setLoadingPreview(prev => ({ ...prev, [g.groupId]: true }));
                            try {
                              const res = await fetch(`/api/review/sonstiges/group/${encodeURIComponent(g.groupId)}/transactions?limit=20`);
                              if (!res.ok) throw new Error('Vorschau konnte nicht geladen werden.');
                              const json = await res.json();
                              setPreviews(prev => ({ ...prev, [g.groupId]: json }));
                            } catch (e: any) {
                              toast(e?.message || 'Vorschau konnte nicht geladen werden.', 'error');
                            } finally {
                              setLoadingPreview(prev => ({ ...prev, [g.groupId]: false }));
                            }
                          }
                        }}
                      >
                        {expanded[g.groupId] ? 'Details verbergen' : 'Details anzeigen'}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <CategoryControl
                        id={g.exampleTransactionId}
                        fingerprintInput={undefined}
                        category={categoryByGroup[g.groupId]}
                        categorySource={'user'}
                        rawText={g.displayName}
                        merchant={g.displayName}
                        onApplied={(_id, next) => {
                          setCategoryByGroup(prev => ({ ...prev, [g.groupId]: next || '' }));
                        }}
                      />
                      <button
                        onClick={() => void handleApply(g)}
                        disabled={workingGroupId === g.groupId}
                        className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60"
                      >
                        {workingGroupId === g.groupId ? 'Übernehme…' : 'Übernehmen'}
                      </button>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={saveRuleByGroup[g.groupId] ?? true}
                          onChange={e => setSaveRuleByGroup(prev => ({ ...prev, [g.groupId]: e.target.checked }))}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-200 dark:border-slate-600 dark:focus:ring-indigo-500/30"
                        />
                        Regel speichern
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={applyPastByGroup[g.groupId] ?? true}
                          onChange={e => setApplyPastByGroup(prev => ({ ...prev, [g.groupId]: e.target.checked }))}
                          disabled={!(saveRuleByGroup[g.groupId] ?? true)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-200 disabled:opacity-50 dark:border-slate-600 dark:focus:ring-indigo-500/30"
                        />
                        Auf vergangene Buchungen anwenden
                      </label>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, [loading, error, summary, categoryByGroup, workingGroupId, saveRuleByGroup, applyPastByGroup]);

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        {header}
        {content}

        {confirmGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">Kategorie übernehmen?</div>
              <div className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                <div>Gruppe/Händler: <span className="font-medium">{confirmGroup.displayName}</span></div>
                <div>Ausgewählte Kategorie: <span className="font-medium">{categoryByGroup[confirmGroup.groupId] || '—'}</span></div>
                <div>Buchungen: <span className="font-medium">{confirmGroup.txCount}</span></div>
                <div>Summe: <span className="font-medium">{formatCurrency((confirmGroup.totalExpenseCents || 0) / 100)}</span></div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {saveRuleByGroup[confirmGroup.groupId] ?? true ? 'Regel speichern' : 'Keine Regel speichern'}
                  {(saveRuleByGroup[confirmGroup.groupId] ?? true) && (applyPastByGroup[confirmGroup.groupId] ?? true) ? ' · Auf Vergangenheit anwenden' : ''}
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmGroup(null)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const g = confirmGroup;
                    setConfirmGroup(null);
                    setWorkingGroupId(g.groupId);
                    try {
                      const res = await fetch('/api/review/sonstiges/apply', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          groupId: g.groupId,
                          categoryId: categoryByGroup[g.groupId],
                          createRule: Boolean(saveRuleByGroup[g.groupId] ?? true),
                          applyToPast: Boolean(applyPastByGroup[g.groupId] ?? true),
                        }),
                      });
                      if (res.status === 409) {
                        const conflict = await res.json();
                        toast(conflict?.message || 'Regelkonflikt – bitte vorhandene Regel prüfen.', 'error');
                        return;
                      }
                      if (!res.ok) throw new Error('Übernahme fehlgeschlagen.');
                      toast(`${g.displayName}: Kategorie übernommen`, 'success');
                      // Remove group locally and update total
                      setSummary(prev => {
                        if (!prev) return prev;
                        const remaining = prev.groups.filter(x => x.groupId !== g.groupId);
                        return {
                          totalSonstigesCents: Math.max(0, (prev.totalSonstigesCents || 0) - (g.totalExpenseCents || 0)),
                          groups: remaining,
                        };
                      });
                    } catch (e: any) {
                      toast(e?.message || 'Übernahme fehlgeschlagen.', 'error');
                    } finally {
                      setWorkingGroupId(null);
                    }
                  }}
                  className="rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500"
                >
                  Bestätigen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// Inline confirmation modal (minimal)
export function ConfirmDialog() {
  return null;
}


