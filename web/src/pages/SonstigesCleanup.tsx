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
    setWorkingGroupId(g.groupId);
    try {
      const res = await fetch('/api/review/sonstiges/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: g.groupId,
          categoryId,
          createRule: Boolean(saveRuleByGroup[g.groupId] ?? true),
          applyToPast: Boolean(applyPastByGroup[g.groupId] ?? true),
        }),
      });
      if (!res.ok) throw new Error('Übernahme fehlgeschlagen.');
      const data = await res.json();
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
      // Clear local choices
      setCategoryByGroup(prev => {
        const copy = { ...prev };
        delete copy[g.groupId];
        return copy;
      });
      setSaveRuleByGroup(prev => {
        const copy = { ...prev };
        delete copy[g.groupId];
        return copy;
      });
      setApplyPastByGroup(prev => {
        const copy = { ...prev };
        delete copy[g.groupId];
        return copy;
      });
    } catch (e: any) {
      toast(e?.message || 'Übernahme fehlgeschlagen.', 'error');
    } finally {
      setWorkingGroupId(null);
    }
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
                </td>
                <td className="px-4 py-3">{g.txCount}</td>
                <td className="px-4 py-3">{formatCurrency((g.totalExpenseCents || 0) / 100)}</td>
                <td className="px-4 py-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400">{g.lastDate}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-2">
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
      </div>
    </AppShell>
  );
}


