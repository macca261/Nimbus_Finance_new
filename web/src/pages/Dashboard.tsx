import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import FinancialOverview from '../components/FinancialOverview';
import BankConnections from '../components/BankConnections';
import SubscriptionTier from '../components/SubscriptionTier';

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

  useEffect(() => {
    const saved = localStorage.getItem('nimbus:lastUpload');
    if (saved) {
      const parsed = JSON.parse(saved);
      setRows(parsed.transactions || []);
    }
  }, []);

  const recent = useMemo(() => rows.slice(0, 10), [rows]);

  return (
    <DashboardLayout>
      <FinancialOverview />
      <SubscriptionTier currentTier={(localStorage.getItem('tier') || 'free')} />
      <BankConnections />
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


