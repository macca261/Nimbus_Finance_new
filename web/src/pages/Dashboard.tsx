import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import FinancialOverview from '../components/FinancialOverview';
import BankConnections from '../components/BankConnections';
import SubscriptionTier from '../components/SubscriptionTier';
import { api } from '../lib/api';

type Tx = {
  id: string;
  date: string;
  amount: number;
  category: string;
  merchant?: string;
  description: string;
};

export default function DashboardPage() {
  const [rows, setRows] = useState<Tx[]>([]);
  const [breakdown, setBreakdown] = useState<{ categoryId: string; total: number }[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [mtd, setMtd] = useState<{ monthToDateSpend: number; lastMonthSpend: number } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('nimbus:lastUpload');
    if (saved) {
      const parsed = JSON.parse(saved);
      setRows(parsed.transactions || []);
    }
    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    api.get('/categories/breakdown', { params: { from, to } }).then(({ data }) => setBreakdown(data.items || [])).catch(() => {});
    api.get('/transactions', { params: { limit: 20 } }).then(({ data }) => setRecent(data.items || [])).catch(() => {});
    api.get('/summary/balance').then(({ data }) => setMtd({ monthToDateSpend: data.monthToDateSpend, lastMonthSpend: data.lastMonthSpend })).catch(() => {});
  }, []);

  const recent = useMemo(() => rows.slice(0, 10), [rows]);

  return (
    <DashboardLayout>
      <FinancialOverview />
      <SubscriptionTier currentTier={(localStorage.getItem('tier') || 'free')} />
      <BankConnections />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-xl p-4">
          <p className="font-semibold mb-2">Spending this month</p>
          <div className="text-2xl font-semibold">{mtd ? (-mtd.monthToDateSpend).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : '—'}</div>
          <div className="text-sm text-gray-600">Last month: {mtd ? (-mtd.lastMonthSpend).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : '—'}</div>
        </div>
        <div className="border rounded-xl p-4">
          <p className="font-semibold mb-2">By category (MTD)</p>
          <ul className="text-sm space-y-1">
            {breakdown.map(b => (
              <li key={b.categoryId} className="flex items-center justify-between">
                <span>{b.categoryId}</span>
                <span>{b.total.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border rounded-xl p-4">
        <p className="font-semibold mb-2">Recent transactions</p>
        <table className="w-full text-sm">
          <thead><tr className="text-gray-600"><th className="text-left p-2">Date</th><th className="text-left p-2">Purpose</th><th className="text-right p-2">Amount</th></tr></thead>
          <tbody>
            {recent.map((r:any) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.bookingDate}</td>
                <td className="p-2 truncate max-w-[480px]">{r.purpose || r.txType || ''}</td>
                <td className={`p-2 text-right ${r.amount < 0 ? 'text-red-600' : 'text-green-700'}`}>{Number(r.amount).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}


