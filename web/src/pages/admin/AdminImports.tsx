import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../layout/AppShell';
import { classnames } from '../../ui/tokens';
import { fetchAdminImports, deleteAdminImports, type AdminImportRun } from '../../api/adminImports';
import { toast } from '../../lib/toast';
import { emitDataMutated } from '../../lib/dataEvents';

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const EMPTY_MESSAGE =
  'Noch keine Imports vorhanden. Lade CSV-Dateien hoch, um Transaktionen anzuzeigen.';

export const AdminImports: React.FC = () => {
  const [imports, setImports] = useState<AdminImportRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await fetchAdminImports();
    if (!response.ok) {
      setError(response.error);
      setImports([]);
      setLoading(false);
      return;
    }
    setImports(response.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedIds(new Set(imports.map(item => item.id)));
      } else {
        setSelectedIds(new Set());
      }
    },
    [imports],
  );

  const toggle = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectedCount = selectedIds.size;

  const handleDelete = useCallback(async () => {
    if (!selectedIds.size || busy) return;
    const ids = Array.from(selectedIds);
    const confirmMessage =
      ids.length === 1
        ? 'Diesen Import und alle dazugehörigen Transaktionen löschen?'
        : `Diese ${ids.length} Importe und alle zugehörigen Transaktionen löschen?`;
    if (typeof window !== 'undefined' && !window.confirm(confirmMessage)) {
      return;
    }

    setBusy(true);
    const response = await deleteAdminImports(ids);
    if (!response.ok) {
      toast(response.error, 'error');
      setBusy(false);
      return;
    }

    const { deletedImports, deletedTransactions } = response.data;
    toast(
      `Gelöscht: ${deletedImports.toLocaleString('de-DE')} Importe (${deletedTransactions.toLocaleString(
        'de-DE',
      )} Transaktionen)`,
      'success',
    );
    setSelectedIds(new Set());
    emitDataMutated({ reason: 'imports:deleted' });
    await load();
    setBusy(false);
  }, [busy, load, selectedIds]);

  const rows = useMemo(() => imports, [imports]);

  return (
    <AppShell>
      <div className={classnames.sectionGap}>
        <header className="space-y-1.5">
          <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-300">Admin</p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">Imports</h1>
          <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Übersicht aller CSV-Importe. Ausgewählte Importe können zusammen mit ihren
            Transaktionen gelöscht werden.
          </p>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-200/80 bg-white/60 p-6 text-sm shadow-sm dark:border-slate-800/70 dark:bg-slate-900/60">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {selectedCount} ausgewählt · {rows.length} Einträge
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => void load()}
                disabled={busy || loading}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900/60"
              >
                Aktualisieren
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy || !selectedCount}
                className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:opacity-60"
              >
                {busy ? 'Lösche…' : 'Ausgewählte löschen'}
              </button>
            </div>
          </div>

          {loading ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">Lade Importe…</p>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300/70 bg-slate-50/70 px-4 py-8 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
              {EMPTY_MESSAGE}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed border-collapse text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <tr>
                    <th className="w-10 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedCount > 0 && selectedCount === rows.length}
                        onChange={event => toggleAll(event.currentTarget.checked)}
                        aria-label="Alle auswählen"
                      />
                    </th>
                    <th className="w-48 px-3 py-2">Importiert</th>
                    <th className="w-48 px-3 py-2">Quelle</th>
                    <th className="px-3 py-2">Datei</th>
                    <th className="w-32 px-3 py-2 text-right">Rows</th>
                    <th className="w-36 px-3 py-2 text-right">Transaktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {rows.map(row => {
                    const checked = selectedIds.has(row.id);
                    const date = new Date(row.createdAt);
                    return (
                      <tr
                        key={row.id}
                        className={checked ? 'bg-indigo-50/70 dark:bg-indigo-950/30' : undefined}
                      >
                        <td className="px-3 py-2 align-middle">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(row.id)}
                            aria-label={`Import ${row.fileName} auswählen`}
                          />
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                          {Number.isNaN(date.getTime()) ? '–' : DATE_TIME_FORMAT.format(date)}
                        </td>
                        <td className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                          {row.source}
                        </td>
                        <td
                          className="px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
                          title={row.fileName}
                        >
                          {row.fileName}
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-slate-500 dark:text-slate-400">
                          {row.rowCount.toLocaleString('de-DE')}
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-slate-500 dark:text-slate-400">
                          {row.insertedCount.toLocaleString('de-DE')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
};

export default AdminImports;


