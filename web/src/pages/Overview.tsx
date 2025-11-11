import AppShell from '../components/layout/AppShell';
import Card from '../components/ui/Card';
import KpiCard from '../components/ui/KpiCard';
import CashflowLine from '../components/charts/CashflowLine';
import SpendDonut from '../components/charts/SpendDonut';
import RecentActivity from '../components/RecentActivity';
import { useOverview } from '../hooks/useOverview';

export default function Overview() {
  const { data, loading } = useOverview();

  if (loading) {
    return (
      <AppShell>
        <div className="p-6">Loading…</div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <div className="p-6">No data available</div>
      </AppShell>
    );
  }

  const kpis = [
    {
      title: 'My Balance',
      value: data.balance.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }),
      sub: 'Compared with last month',
      trend: 2.7,
    },
    {
      title: 'Monthly Spent',
      value: (data.expense6m.at(-1)?.amount ?? 0).toLocaleString('de-DE', {
        style: 'currency',
        currency: 'EUR',
      }),
      sub: 'Compared with last month',
      trend: 0.8,
    },
    {
      title: 'Monthly Income',
      value: (data.income6m.at(-1)?.amount ?? 0).toLocaleString('de-DE', {
        style: 'currency',
        currency: 'EUR',
      }),
      sub: 'Compared with last month',
      trend: -0.3,
    },
  ];

  const cashflow = (data.income6m || []).map((d, i) => ({
    month: d.month,
    income: d.amount,
    expense: data.expense6m[i]?.amount ?? 0,
  }));

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-xl md:text-2xl font-semibold">Welcome back, Alex 👋</h1>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((k, i) => (
          <Card key={i}>
            <KpiCard {...k} />
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <CashflowLine data={cashflow} />
        </div>
        <SpendDonut data={data.categories} />
      </div>

      {/* Savings + Recent row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <Card>
          <div className="p-4 text-sm font-medium">Savings</div>
          <div className="px-4 pb-4 space-y-4">
            <GoalRow name="Education" pct={72} amt="40,326.12 €" />
            <GoalRow name="Car" pct={46} amt="12,400.00 €" color="bg-blue-500" />
            <GoalRow name="Emergency" pct={58} amt="7,950.00 €" color="bg-emerald-500" />
          </div>
        </Card>
        <RecentActivity items={data.recent} />
        <Card>
          <div className="p-4 text-sm font-medium">Tips</div>
          <ul className="px-4 pb-4 text-sm space-y-2 text-slate-600 dark:text-slate-400">
            <li>• Set a monthly budget for Dining to curb overspending.</li>
            <li>• You're 72% to your Education goal. Nice!</li>
            <li>• Consider consolidating subscriptions.</li>
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}

function GoalRow({
  name,
  pct,
  amt,
  color = 'bg-violet-500',
}: {
  name: string;
  pct: number;
  amt: string;
  color?: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{name}</span>
        <span className="text-slate-500 dark:text-slate-400">{pct}%</span>
      </div>
      <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
        <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Target: {amt}</div>
    </div>
  );
}

