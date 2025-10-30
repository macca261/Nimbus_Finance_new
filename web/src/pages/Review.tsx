import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type ReviewItem = { id: string; bookingDate: string; amount: number; purpose?: string; counterpartName?: string; category?: string | null };

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [category, setCategory] = useState('Groceries');
  const [pattern, setPattern] = useState('');
  const [maxConfidence, setMaxConfidence] = useState(0.7);

  async function load() {
    const { data } = await api.get('/review', { params: { limit: 200, maxConfidence } });
    setItems(data.items);
    setSelected({});
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [maxConfidence]);

  async function bulkApply() {
    const ids = Object.keys(selected).filter(id => selected[id]);
    await Promise.all(ids.map(id => api.patch(`/transactions/${id}/category`, { category, pattern: pattern || undefined })));
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Review Queue</h1>
      <div className="flex items-center gap-2 mb-3">
        <label className="text-sm">Max confidence</label>
        <input className="input input-bordered input-sm w-24" type="number" step="0.05" min={0} max={0.99} value={maxConfidence} onChange={e => setMaxConfidence(parseFloat(e.target.value))} />
        <select className="select select-bordered select-sm" value={category} onChange={e => setCategory(e.target.value)}>
          {['Groceries','Transportation','Fees','Income','Shopping','Dining','Subscriptions','Housing','Utilities','Health','Entertainment','Other'].map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input className="input input-bordered input-sm" placeholder="Always do this for pattern (optional)" value={pattern} onChange={e => setPattern(e.target.value)} />
        <button className="btn btn-sm" onClick={bulkApply}>Apply to selected</button>
      </div>
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="p-2"><input type="checkbox" onChange={e => {
                const checked = e.target.checked; setSelected(Object.fromEntries(items.map(i => [i.id, checked])));
              }} /></th>
              <th className="p-2">Date</th>
              <th className="p-2">Description</th>
              <th className="p-2">Amount</th>
              <th className="p-2">Current</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id} className="border-t">
                <td className="p-2"><input type="checkbox" checked={!!selected[it.id]} onChange={e => setSelected(s => ({ ...s, [it.id]: e.target.checked }))} /></td>
                <td className="p-2 whitespace-nowrap">{it.bookingDate}</td>
                <td className="p-2">
                  <div className="font-medium">{it.counterpartName || '—'}</div>
                  <div className="text-gray-600">{it.purpose}</div>
                </td>
                <td className="p-2 whitespace-nowrap">{it.amount.toFixed(2)} EUR</td>
                <td className="p-2 whitespace-nowrap">{it.category || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


