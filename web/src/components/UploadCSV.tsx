import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { api } from '../lib/api';

type Tx = {
  id: string;
  date: string;
  amount: number;
  description: string;
  merchant?: string;
  category: string;
  confidence: number;
};

const CATEGORY_OPTIONS = [
  'Groceries','Shopping','Dining','Transportation','Subscriptions','Housing','Utilities','Income','Health','Entertainment','Other'
];

function formatAmount(n: number) {
  const f = n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  return n < 0 ? f : `+${f}`;
}

export default function UploadCSV() {
  const [progress, setProgress] = useState(0);
  const [bank, setBank] = useState<string>('');
  const [rows, setRows] = useState<Tx[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [bulkMerchant, setBulkMerchant] = useState<string>('');
  const [bulkCategory, setBulkCategory] = useState<string>('');
  const [applyInfo, setApplyInfo] = useState<string | null>(null);

  const totalIncome = useMemo(() => rows.filter(r => r.amount > 0).reduce((a,b) => a + b.amount, 0), [rows]);
  const totalExpense = useMemo(() => rows.filter(r => r.amount < 0).reduce((a,b) => a + Math.abs(b.amount), 0), [rows]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null);
    if (!acceptedFiles.length) return;
    const file = acceptedFiles[0];
    const form = new FormData();
    form.append('file', file);

    try {
      setProgress(10);
      await new Promise(r => setTimeout(r, 120));
      setProgress(25);
      const { data } = await api.post('/csv/upload', form, { onUploadProgress: (e) => {
        if (e.total) {
          const p = Math.round((e.loaded / e.total) * 20);
          setProgress(10 + p);
        }
      }});
      setProgress(70);
      const txs: Tx[] = data.transactions;
      setBank(data.bank);
      setRows(txs);
      localStorage.setItem('nimbus:lastUpload', JSON.stringify({ bank: data.bank, transactions: txs }));
      setProgress(100);
      setTimeout(() => setProgress(0), 800);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Upload failed';
      const details = err?.response?.data?.details;
      setError(details ? `${msg}: ${details}` : msg);
      setProgress(0);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.csv'] }
  });

  function persist(rowsToStore: Tx[]) {
    try { localStorage.setItem('nimbus:lastUpload', JSON.stringify({ bank, transactions: rowsToStore })); } catch {}
  }

  function updateCategory(id: string, category: string) {
    setRows(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, category, confidence: Math.max(r.confidence, 0.8) } : r);
      persist(updated);
      return updated;
    });
  }

  function applyBulk() {
    if (!bulkMerchant || !bulkCategory) {
      setApplyInfo('Type a merchant keyword and choose a category to apply.');
      return;
    }
    setRows(prev => {
      let changed = 0;
      const updated = prev.map(r => {
        const match = (r.merchant || '').toLowerCase().includes(bulkMerchant.toLowerCase());
        if (match) { changed += 1; return { ...r, category: bulkCategory, confidence: 0.9 }; }
        return r;
      });
      persist(updated);
      setApplyInfo(changed > 0 ? `Applied ${changed} change${changed === 1 ? '' : 's'}.` : 'No matching transactions found.');
      return updated;
    });
  }

  const categoryGroups = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const k = r.category;
      map.set(k, (map.get(k) || 0) + Math.abs(r.amount));
    }
    return Array.from(map.entries()).map(([k, v]) => ({ category: k, total: v }));
  }, [rows]);

  return (
    <div className="space-y-6">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition transform ${isDragActive ? 'border-primary-500 bg-primary-300/10 scale-[1.01]' : 'border-gray-300 hover:border-primary-400 hover:scale-[1.005]'}`}
      >
        <input {...getInputProps()} />
        <p className="text-xl font-medium">Drop your German bank CSV here</p>
        <p className="text-sm text-gray-500 mt-1">We’ll detect the bank format automatically and categorize instantly.</p>
        {progress > 0 && (
          <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {rows.length > 0 && (
        <div className="space-y-4 animate-[fadeIn_300ms_ease-out]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Parsed {rows.length} transactions {bank && <span className="text-gray-500">from {bank}</span>}</h3>
              <p className="text-sm text-gray-600">Income {formatAmount(totalIncome)} · Expenses {formatAmount(-totalExpense)}</p>
            </div>
            <div className="flex items-center gap-2">
              <input placeholder="Merchant contains…" className="input w-56" value={bulkMerchant} onChange={e => setBulkMerchant(e.target.value)} />
              <select className="input w-44" value={bulkCategory} onChange={e => setBulkCategory(e.target.value)}>
                <option value="">Bulk set category…</option>
                {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button className="btn btn-primary disabled:opacity-50" onClick={applyBulk} disabled={!bulkMerchant || !bulkCategory} title={!bulkMerchant || !bulkCategory ? 'Type a merchant and choose a category' : ''}>Apply</button>
              <Link to="/dashboard" className="btn">View dashboard</Link>
            </div>
          </div>
          <p className="text-xs text-gray-500">Tip: Type a merchant keyword (e.g., "Lidl") and choose a category, then click Apply. You can also change categories inline per row.</p>
          {applyInfo && <p className="text-xs text-green-600">{applyInfo}</p>}
          <div className="overflow-x-auto border rounded-xl">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2">Date</th>
                  <th className="text-left px-4 py-2">Merchant</th>
                  <th className="text-left px-4 py-2">Description</th>
                  <th className="text-left px-4 py-2">Amount</th>
                  <th className="text-left px-4 py-2">Category</th>
                  <th className="text-left px-4 py-2">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map(r => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2 whitespace-nowrap">{r.date}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{r.merchant || '—'}</td>
                    <td className="px-4 py-2">{r.description}</td>
                    <td className={`px-4 py-2 whitespace-nowrap ${r.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatAmount(r.amount)}</td>
                    <td className="px-4 py-2">
                      <select className="input w-40" value={r.category} onChange={e => updateCategory(r.id, e.target.value)}>
                        {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">{Math.round(r.confidence * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500">Showing first 200 rows for performance. All transactions are stored locally for the dashboard.</p>
        </div>
      )}
    </div>
  );
}


