import { useState } from 'react';
import { toast } from '../../lib/toast';

type ResetDbCardProps = {
  onReset?: () => Promise<void> | void;
  onManageImports?: () => void;
};

export const ResetDbCard: React.FC<ResetDbCardProps> = ({ onReset, onManageImports }) => {
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleReset = async () => {
    const confirm = window.confirm(
      'Datenbank zurücksetzen? Alle importierten Umsätze werden gelöscht.',
    );
    if (!confirm) return;

    setIsBusy(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/reset', { method: 'POST' });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error('Reset failed', json);
        const errorMessage = json?.message ?? response.statusText ?? 'Zurücksetzen fehlgeschlagen.';
        toast(errorMessage, 'error');
        setMessage(`Fehler: ${errorMessage}`);
        return;
      }

      console.log('Database reset OK');
      toast('Datenbank zurückgesetzt.', 'success');
      setMessage(`OK — gelöscht: ${json?.deleted ?? 0}`);
      const next = onReset?.();
      if (next instanceof Promise) {
        await next;
      }
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      toast(errMessage, 'error');
      setMessage(`Fehler: ${errMessage}`);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed shadow-sm dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-amber-700 dark:text-amber-100">Admin</h3>
          <p className="text-xs text-amber-600 dark:text-amber-200/80">
            Datenbank leeren oder Importe bereinigen (nur lokal/dev)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onManageImports?.()}
            disabled={!onManageImports}
            className="rounded-full border border-amber-300 bg-white/90 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:border-amber-400 hover:bg-white disabled:opacity-60 dark:border-amber-400/50 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:border-amber-300"
          >
            Importe verwalten
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={isBusy}
            className="rounded-full border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:border-amber-500 hover:text-amber-800 disabled:opacity-60 dark:border-amber-400/60 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:border-amber-300"
          >
            {isBusy ? 'Zurücksetzen…' : 'Reset DB'}
          </button>
        </div>
      </div>
      {message ? <div className="mt-2 text-xs font-medium">{message}</div> : null}
    </div>
  );
};


