import { useEffect, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import OverviewCards from './OverviewCards';

type Tx = {
  id: string;
  date: string;
  amount: number;
  category: string;
  merchant?: string;
  description: string;
};

const COLORS = ['#4361ee','#4895ef','#4cc9f0','#60a5fa','#34d399','#fbbf24','#ef4444','#a78bfa','#fb7185','#22c55e'];

export default function Dashboard() {
  const [rows, setRows] = useState<Tx[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('nimbus:lastUpload');
    if (saved) {
      const parsed = JSON.parse(saved);
      setRows(parsed.transactions || []);
    }
  }, []);

  const balance = useMemo(() => rows.reduce((a,b) => a + b.amount, 0), [rows]);
  const income = useMemo(() => rows.filter(r => r.amount > 0).reduce((a,b) => a + b.amount, 0), [rows]);
  const expenses = useMemo(() => rows.filter(r => r.amount < 0).reduce((a,b) => a + Math.abs(b.amount), 0), [rows]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.amount < 0) map.set(r.category, (map.get(r.category) || 0) + Math.abs(r.amount));
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [rows]);

  const recent = useMemo(() => rows.slice(0, 10), [rows]);

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 min-h-screen">
        <Topbar />
        <div className="p-4 space-y-6">
          <OverviewCards />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-xl p-4">
          <p className="text-gray-500 text-sm">Balance</p>
          <p className="text-2xl font-semibold">{balance.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</p>
        </div>
        <div className="border rounded-xl p-4">
          <p className="text-gray-500 text-sm">Income</p>
          <p className="text-2xl font-semibold text-green-600">{income.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</p>
        </div>
        <div className="border rounded-xl p-4">
          <p className="text-gray-500 text-sm">Expenses</p>
          <p className="text-2xl font-semibold text-red-600">{expenses.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</p>
        </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-xl p-4 h-80">
          <p className="font-semibold mb-2">Spending by category</p>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie dataKey="value" data={byCategory} innerRadius={60} outerRadius={100} paddingAngle={2}>
                {byCategory.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => `${Number(v).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
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
          </div>
        </div>
      </div>
    </div>
  );
}


