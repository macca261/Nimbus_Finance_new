import { useMemo, useState } from 'react';
import { api } from '../lib/api';

type Props = {
  headers: string[];
  sampleRows: string[][];
};

const CANONICAL_FIELDS = [
  'bookingDate',
  'valueDate',
  'amount',
  'currency',
  'counterpartName',
  'counterpartIban',
  'counterpartBic',
  'purpose',
  'txType',
  'rawCode',
] as const;

type Field = typeof CANONICAL_FIELDS[number];

export default function ColumnMapWizard({ headers, sampleRows }: Props) {
  const [mapping, setMapping] = useState<Record<Field, string | undefined>>({
    bookingDate: undefined,
    valueDate: undefined,
    amount: undefined,
    currency: undefined,
    counterpartName: undefined,
    counterpartIban: undefined,
    counterpartBic: undefined,
    purpose: undefined,
    txType: undefined,
    rawCode: undefined,
  });
  const [adapterId, setAdapterId] = useState('custom_csv_v1');
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uniqueHeaders = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const h of headers) {
      const k = (h || '').trim().toLowerCase();
      if (!k) continue;
      if (!seen.has(k)) { seen.add(k); out.push(h); }
    }
    return out;
  }, [headers]);

  const preview = useMemo(() => {
    const idx = (h?: string) => (h ? headers.indexOf(h) : -1);
    return sampleRows.slice(0, 5).map(r => {
      const get = (f: Field) => {
        const i = idx(mapping[f]);
        return i >= 0 ? r[i] : '';
      };
      return {
        bookingDate: get('bookingDate'),
        valueDate: get('valueDate'),
        amount: get('amount'),
        currency: get('currency'),
        counterpartName: get('counterpartName'),
        counterpartIban: get('counterpartIban'),
        counterpartBic: get('counterpartBic'),
        purpose: get('purpose'),
        txType: get('txType'),
        rawCode: get('rawCode'),
      };
    });
  }, [headers, mapping, sampleRows]);

  async function saveAdapter() {
    setError(null);
    setSaving(true);
    try {
      const map: any = {};
      for (const f of CANONICAL_FIELDS) {
        if (mapping[f]) map[f] = mapping[f];
      }
      const payload = {
        id: adapterId,
        match: { anyHeader: headers.slice(0, 10) },
        map,
      };
      const { data } = await api.post('/adapters/user', payload);
      setSavedId(data.id);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to save adapter');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-semibold mb-2">Map your columns</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {CANONICAL_FIELDS.map((f) => (
          <div key={f} className="flex items-center gap-2">
            <label className="w-40 text-sm font-medium">{f}</label>
            <select
              className="select select-bordered select-sm flex-1"
              value={mapping[f] || ''}
              onChange={(e) => setMapping(m => ({ ...m, [f]: e.target.value || undefined }))}
            >
              <option key={`none-${f}`} value="">—</option>
              {uniqueHeaders.map(h => (
                <option key={`opt-${f}-${(h||'').toString().toLowerCase().replace(/[^a-z0-9]+/g,'-')}`} value={h}>{h}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <input className="input input-bordered input-sm" value={adapterId} onChange={e => setAdapterId(e.target.value)} placeholder="Adapter ID" />
        <button className="btn btn-sm btn-primary" onClick={saveAdapter} disabled={saving}>Save adapter</button>
        {savedId && <span className="text-sm text-green-700">Saved as {savedId}</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      <div className="mt-6">
        <h4 className="font-medium mb-2">Preview (first 5 rows)</h4>
        <pre className="text-xs bg-gray-50 p-3 rounded border overflow-auto">{JSON.stringify(preview, null, 2)}</pre>
      </div>
    </div>
  );
}


