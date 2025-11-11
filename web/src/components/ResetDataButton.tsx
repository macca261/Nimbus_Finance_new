import React, { useState } from 'react';
import { useFinanceStore } from '../state/useFinanceStore';

type Props = {
  onReset?: () => void;
};

export const ResetDataButton: React.FC<Props> = ({ onReset }) => {
  const setFromTransactions = useFinanceStore(state => state.setFromTransactions);
  const setError = useFinanceStore(state => state.setError);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleClick = async () => {
    if (!window.confirm('Demo-Daten wirklich zurücksetzen?')) return;
    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/dev/reset', { method: 'POST' });
      if (!res.ok) {
        if (res.status === 403) {
          setFeedback('Reset ist in dieser Umgebung nicht verfügbar.');
          return;
        }
        throw new Error('Reset fehlgeschlagen');
      }
      const json = await res.json().catch(() => ({ message: '' }));
      setFromTransactions([]);
      setError(null);
      setFeedback(json?.message ?? 'Demo-Daten wurden zurückgesetzt.');
      onReset?.();
    } catch (error: any) {
      const message = error?.message || 'Reset fehlgeschlagen.';
      setFeedback(message);
      console.error('[ResetDataButton] error', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1 text-right">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:border-amber-300 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-300/60 dark:bg-amber-400/10 dark:text-amber-200 dark:hover:border-amber-200 dark:hover:text-amber-100"
      >
        {loading ? 'Setze zurück…' : 'Daten zurücksetzen'}
        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wide dark:bg-amber-500/40">
          Dev
        </span>
      </button>
      {feedback && <p className="text-[11px] text-slate-500 dark:text-slate-400">{feedback}</p>}
    </div>
  );
};
