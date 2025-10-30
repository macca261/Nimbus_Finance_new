import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function ReportsPage() {
  const [analysis, setAnalysis] = useState<any>(null);
  const [days, setDays] = useState(90);
  const [currency] = useState('EUR');

  async function load() {
    const { data } = await api.get('/insights/spending-analysis', { params: { days } });
    setAnalysis(data);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [days]);

  function exportPdf() {
    // Simple print-to-PDF for now
    window.print();
  }

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Financial Reports</h1>
      <div className="flex items-center gap-3 mb-4">
        <select className="select select-bordered select-sm" value={days} onChange={e => setDays(parseInt(e.target.value, 10))}>
          {[30, 90, 180, 365].map(d => <option key={d} value={d}>Last {d} days</option>)}
        </select>
        <button className="btn btn-sm" onClick={exportPdf}>Export PDF</button>
      </div>
      {analysis && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded p-4">
            <h2 className="font-semibold mb-2">Category breakdown</h2>
            <ul className="text-sm space-y-1">
              {analysis.categories.map((c: any) => (
                <li key={c.category} className="flex items-center justify-between">
                  <span>{c.category}</span>
                  <span>{c.total.toFixed(2)} {currency}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border rounded p-4">
            <h2 className="font-semibold mb-2">Top merchants</h2>
            <ul className="text-sm space-y-1">
              {analysis.merchants.map((m: any) => (
                <li key={m.merchant} className="flex items-center justify-between">
                  <span>{m.merchant}</span>
                  <span>{m.total.toFixed(2)} {currency}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}


