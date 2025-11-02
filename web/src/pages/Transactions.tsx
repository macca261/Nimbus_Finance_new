import { useEffect, useState } from 'react';
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

  useEffect(() => {
    fetch('/api/transactions?limit=100')
      .then(r => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((j) => setItems((j?.data as Tx[]) ?? []))
      .catch(() => setError('Fehler beim Laden der Transaktionen.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Laden…</div>;
  if (error) return <div>{error}</div>;

  return (
    <div style={{ paddingRight: 8 }}>
      <h2>Transaktionen</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '6px 4px' }}>Datum</th>
            <th style={{ textAlign: 'left', padding: '6px 4px' }}>Text</th>
            <th style={{ textAlign: 'right', padding: '6px 4px' }}>Betrag</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t, i) => (
            <tr key={t.id ?? i}>
              <td style={{ padding: '6px 4px' }}>{t.bookingDate ?? '—'}</td>
              <td style={{ padding: '6px 4px' }}>{t.purpose ?? '—'}</td>
              <td
                style={{
                  padding: '6px 4px',
                  textAlign: 'right',
                  color: (t.amountCents ?? 0) < 0 ? 'crimson' : '#157f1f',
                  fontWeight: 600,
                }}
              >
                {fmt(t.amountCents, t.currency)}
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={3} style={{ padding: '10px 4px', opacity: 0.7 }}>
                Keine Daten. Laden Sie eine CSV hoch.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
