import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import FinancialOverview from '../components/FinancialOverview';
import BankConnections from '../components/BankConnections';
import SubscriptionTier from '../components/SubscriptionTier';
import { api } from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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
  const [summary, setSummary] = useState<any>(null);
  const [recurring, setRecurring] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem('nimbus:lastUpload');
    if (saved) {
      const parsed = JSON.parse(saved);
      setRows(parsed.transactions || []);
    }
    const today = new Date();
    const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    api.get('/insights/monthly-summary', { params: { month: ym } }).then(({ data }) => setSummary(data)).catch(() => {});
    api.get('/insights/recurring').then(({ data }) => setRecurring(data.items || [])).catch(() => {});
    api.get('/insights/spending-analysis', { params: { days: 90 } }).then(({ data }) => setAnalysis(data)).catch(() => {});
  }, []);

  const recent = useMemo(() => rows.slice(0, 10), [rows]);

  return (
    <DashboardLayout>
      <FinancialOverview />
      <SubscriptionTier currentTier={(localStorage.getItem('tier') || 'free')} />
      <BankConnections />
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded-xl p-4">
            <p className="font-semibold mb-2">Monthly summary ({summary.month})</p>
            <div className="text-sm mb-2">Net: {(summary.net).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.categories}>
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total" fill="#8884d8" name="Spending" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="border rounded-xl p-4">
            <p className="font-semibold mb-2">Spending trend (last 6 months)</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.trend}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="income" fill="#34d399" name="Income" />
                  <Bar dataKey="expenses" fill="#f87171" name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {recurring.length > 0 && (
        <div className="border rounded-xl p-4 mt-4">
          <p className="font-semibold mb-2">Recurring subscriptions</p>
          <ul className="divide-y text-sm">
            {recurring.slice(0, 10).map((r, idx) => (
              <li key={idx} className="py-2 flex items-center justify-between">
                <div>
                  <div className="font-medium">{r.merchant}</div>
                  <div className="text-gray-600">{r.cadence} · Next due {r.nextDue}</div>
                </div>
                <div>{r.amount.toFixed(2)} EUR</div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="border rounded-xl p-4">
        <p className="font-semibold mb-2">Recent transactions</p>
        <ul className="divide-y">
          {recent.map(r => (
            <li key={r.id} className="py-2 flex items-center justify-between">
              <div>
                <p className="font-medium">{r.merchant || r.description.slice(0, 40)}</p>
                <p className="text-xs text-gray-500">{r.date} · {r.category}</p>
              </div>
              <div className={r.amount < 0 ? 'text-red-600' : 'text-green-600'}>
                {r.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </DashboardLayout>
  );
}


