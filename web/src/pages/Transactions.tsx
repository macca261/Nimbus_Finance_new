import { useCallback, useEffect, useState } from 'react';
import { Tx } from '@/types/tx';

type TxRow = Tx;

const fmt = (cents?: number, cur = 'EUR') =>
  typeof cents === 'number'
    ? (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: cur })
    : '—';

export default function TransactionsPage() {
  const [items, setItems] = useState<TxRow[]>([]);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || '/api';
  const cleanBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
  const exportHref = `${cleanBase}/transactions.csv`;

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/transactions?limit=200');
      if (!res.ok) throw new Error('Fehler beim Laden');
      const json = await res.json().catch(() => ({ data: [] }));
      setItems((json?.data as TxRow[]) ?? []);
    } catch {
      setError('Fehler beim Laden der Transaktionen.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleReset = useCallback(async () => {
    try {
      setResetting(true);
      setError('');
      const res = await fetch(`${cleanBase}/debug/reset`, { method: 'POST' });
      if (!res.ok) throw new Error('Reset fehlgeschlagen');
      await fetchTransactions();
    } catch {
      setError('Zurücksetzen fehlgeschlagen.');
    } finally {
      setResetting(false);
    }
  }, [cleanBase, fetchTransactions]);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Transaktionen</h2>
          <p className="text-sm text-slate-500">Alle Buchungen der letzten CSV-Uploads.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={exportHref}
            download="transactions.csv"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
          >
            CSV exportieren
          </a>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700 transition hover:border-amber-300 hover:bg-amber-100 disabled:opacity-60"
          >
            {resetting ? 'Setze zurück…' : 'Daten zurücksetzen'}
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Buchungstag</th>
                <th className="px-4 py-3">Verwendungszweck</th>
                <th className="px-4 py-3 text-right">Betrag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                    Lade Transaktionen…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                    Keine Daten. Lade eine CSV hoch.
                  </td>
                </tr>
              ) : (
                items.map((t, i) => (
                  <tr key={t.id ?? i} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 text-slate-600">{t.bookingDate ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-800">
                      <span title={t.purpose ?? ''} className="block max-w-[520px] truncate">
                        {t.purpose ?? '—'}
                      </span>
                      {t.counterpartName && <span className="text-xs text-slate-500">{t.counterpartName}</span>}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold tabular-nums ${ (t.amountCents ?? 0) < 0 ? 'text-rose-600' : 'text-emerald-600' }`}>
                      {fmt(t.amountCents, t.currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
