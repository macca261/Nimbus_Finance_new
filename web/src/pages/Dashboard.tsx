import { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import FinancialHealthScore from '../components/dashboard/FinancialHealthScore';
import NetWorthCard from '../components/dashboard/NetWorthCard';
import SpendingByCategory from '../components/dashboard/SpendingByCategory';
import RecentTransactions from '../components/dashboard/RecentTransactions';
import QuickActions from '../components/dashboard/QuickActions';
import BillsOverview from '../components/dashboard/BillsOverview';
import { http } from '@/lib/api';

type Tx = {
  id: string;
  date: string;
  amount: number;
  category: string;
  merchant?: string;
  description: string;
};

export default function DashboardPage() {
  const [breakdown, setBreakdown] = useState<{ categoryId: string; total: number }[]>([]);
  const [recentRows, setRecentRows] = useState<any[]>([]);
  const [mtd, setMtd] = useState<{ monthToDateSpend: number; lastMonthSpend: number } | null>(null);

  useEffect(() => {
    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    http.get(`/api/categories/breakdown?from=${from}&to=${to}`).then((data) => setBreakdown((data as any).items || [])).catch(() => {});
    http.get('/api/transactions?limit=20').then((data) => setRecentRows((data as any).items || (data as any).rows || [])).catch(() => {});
    http.get('/api/summary/balance').then((data) => setMtd({ monthToDateSpend: (data as any).monthToDateSpend, lastMonthSpend: (data as any).lastMonthSpend })).catch(() => {});
  }, []);

  return (
    <DashboardLayout>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <FinancialHealthScore />
        <NetWorthCard />
        <QuickActions />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <SpendingByCategory items={breakdown} />
        </div>
        <BillsOverview items={[]} />
      </div>
      <div className="mt-4">
        <RecentTransactions rows={recentRows} />
      </div>
    </DashboardLayout>
  );
}


