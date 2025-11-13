import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from '../../lib/toast';
import { useImportHistory } from '../../hooks/useImportHistory';

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export type ManageImportsDialogProps = {
  open: boolean;
  onClose: () => void;
  onDeleted?: () => Promise<void> | void;
};

export function ManageImportsDialog({ open, onClose, onDeleted }: ManageImportsDialogProps) {
  const { entries, loading, refetch } = useImportHistory();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      void refetch();
      setSelected([]);
    }
  }, [open, refetch]);

  const rows = useMemo(
    () => entries.filter(entry => entry.id).map(entry => ({
      id: String(entry.id),
      fileName: entry.fileName ?? 'Unbenannt',
      profileId: entry.profileId,
      importedAt: entry.importedAt,
      transactionCount: entry.rowsImported ?? 0,
      confidence: entry.confidence ?? null,
    })),
    [entries],
  );

  useEffect(() => {
    if (!open) {
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? rows.map(row => row.id) : []);
  };

  const toggleOne = (id: string) => {
    setSelected(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]));
  };

  const handleDelete = async () => {
    if (!selected.length) {
      toast('Bitte wähle mindestens einen Import aus.', 'info');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/admin/imports', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selected }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error('Delete imports failed', json);
        const message = json?.message ?? 'Importe konnten nicht gelöscht werden.';
        toast(message, 'error');
        return;
      }
      toast('Ausgewählte Importe wurden gelöscht.', 'success');
      await refetch();
      setSelected([]);
      const next = onDeleted?.();
      if (next instanceof Promise) {
        await next;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Delete imports failed', message);
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (busy) return;
    setSelected([]);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-900/10 dark:border-slate-800/70 dark:bg-slate-900">
        <header className="flex items-center justify-between border-b border-slate-200/70 px-6 py-4 dark:border-slate-800/70">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Importe verwalten</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Lösche einzelne Importe, um fehlerhafte Daten zu entfernen.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
          >
            Schließen
          </button>
        </header>
        <div className="max-h-[420px] overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">Lade Importe…</p>
          ) : rows.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">Keine Importe gefunden.</p>
          ) : (
            <table className="w-full table-fixed border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <th className="w-10 px-2 py-2">
                    <input
                      type="checkbox"
                      checked={selected.length > 0 && selected.length === rows.length}
                      onChange={event => toggleAll(event.currentTarget.checked)}
                      aria-label="Alle auswählen"
                    />
                  </th>
                  <th className="px-2 py-2">Importiert</th>
                  <th className="px-2 py-2">Quelle</th>
                  <th className="px-2 py-2">Datei</th>
                  <th className="px-2 py-2 text-right">Umsätze</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const checked = selected.includes(row.id);
                  const date = new Date(row.importedAt);
                  return (
                    <tr key={row.id} className="border-t border-slate-100 text-sm dark:border-slate-800">
                      <td className="px-2 py-2 align-middle">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOne(row.id)}
                          aria-label={`Import ${row.fileName} auswählen`}
                        />
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-500 dark:text-slate-400">
                        {Number.isNaN(date.getTime()) ? '–' : DATE_TIME_FORMAT.format(date)}
                      </td>
                      <td className="px-2 py-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                        {row.profileId}
                      </td>
                      <td className="px-2 py-2 max-w-[160px] truncate text-slate-700 dark:text-slate-200" title={row.fileName}>
                        {row.fileName}
                      </td>
                      <td className="px-2 py-2 text-right text-xs text-slate-500 dark:text-slate-400">
                        {row.transactionCount?.toLocaleString('de-DE') ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-slate-200/70 px-6 py-4 text-xs dark:border-slate-800/70">
          <div className="text-slate-500 dark:text-slate-400">
            {selected.length} ausgewählt · {rows.length} Einträge
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={busy}
              className="rounded-full border border-slate-200 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/70"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy || !selected.length}
              className="rounded-full bg-rose-600 px-4 py-1.5 font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:opacity-60"
            >
              Ausgewählte löschen
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

export default ManageImportsDialog;
