import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import ExplainChip from '../components/ExplainChip';

type Tx = {
  id: string;
  bookingDate: string;
  amount: number;
  currency?: string;
  purpose?: string;
  counterpartName?: string;
  category?: string | null;
  confidence?: number;
  explain?: { method: 'rule' | 'ml' | 'ai'; confidence: number; reason?: string };
};

export default function TransactionsPage() {
  const [items, setItems] = useState<Tx[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');

  async function load() {
    const { data } = await api.get('/transactions', { params: { offset: page * pageSize, limit: pageSize, q, category: category || undefined } });
    setItems(data.items);
    setTotal(data.total);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page, pageSize]);

  const pages = useMemo(() => Math.ceil(total / pageSize), [total, pageSize]);

  async function recategorize(id: string, newCat: string) {
    await api.patch(`/transactions/${id}/category`, { category: newCat });
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Transactions</h1>
      <div className="flex gap-3 mb-3">
        <input className="input input-bordered input-sm" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} />
        <select className="select select-bordered select-sm" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          {['Groceries','Transportation','Fees','Income','Shopping','Dining','Subscriptions','Housing','Utilities','Health','Entertainment','Other'].map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button className="btn btn-sm" onClick={() => { setPage(0); load(); }}>Filter</button>
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="p-2">Date</th>
              <th className="p-2">Description</th>
              <th className="p-2">Amount</th>
              <th className="p-2">Category</th>
              <th className="p-2">Explain</th>
            </tr>
          </thead>
          <tbody>
            {items.map(tx => (
              <tr key={tx.id} className="border-t">
                <td className="p-2 whitespace-nowrap">{tx.bookingDate}</td>
                <td className="p-2">
                  <div className="font-medium">{tx.counterpartName || '—'}</div>
                  <div className="text-gray-600">{tx.purpose}</div>
                </td>
                <td className="p-2 whitespace-nowrap">{tx.amount.toFixed(2)} {tx.currency || 'EUR'}</td>
                <td className="p-2">
                  <select className="select select-bordered select-xs" value={tx.category || ''} onChange={(e) => recategorize(tx.id, e.target.value)}>
                    <option value="">Uncategorized</option>
                    {['Groceries','Transportation','Fees','Income','Shopping','Dining','Subscriptions','Housing','Utilities','Health','Entertainment','Other'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  {tx.explain && <ExplainChip method={tx.explain.method} confidence={tx.explain.confidence} reason={tx.explain.reason} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3 text-sm">
        <div>Page {page + 1} / {pages || 1} — Total {total}</div>
        <div className="flex items-center gap-2">
          <button className="btn btn-sm" disabled={page <= 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Prev</button>
          <button className="btn btn-sm" disabled={(page + 1) >= pages} onClick={() => setPage(p => p + 1)}>Next</button>
          <select className="select select-bordered select-sm" value={pageSize} onChange={e => { setPageSize(parseInt(e.target.value, 10)); setPage(0); }}>
            {[50,100,200,500].map(n => <option key={n} value={n}>{n}/page</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}


