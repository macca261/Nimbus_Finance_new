import { useEffect, useState } from 'react';
import { Card, CardBody, Stat } from '../components/ui/Card';
import { Donut } from '../components/charts/Donut';
import { MonthBars } from '../components/charts/MonthBars';

type BalanceResp = { data: { balanceCents: number; currency: string } };
type MonthlyResp = { data: { month: string; incomeCents: number; expenseCents: number }[] };
type CategoriesResp = { data: { category: string; amountCents: number }[] };
type Tx = { id: number; bookingDate: string; purpose: string; amountCents: number; currency: string };

export default function Dashboard() {
  const [balance, setBalance] = useState<BalanceResp['data']>({ balanceCents: 0, currency: 'EUR' });
  const [monthly, setMonthly] = useState<MonthlyResp['data']>([]);
  const [cats, setCats] = useState<CategoriesResp['data']>([]);
  const [recent, setRecent] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [balanceRes, monthlyRes, catsRes, recentRes] = await Promise.all([
          fetch('/api/summary/balance').then(r => r.json()).catch(() => ({ data: { balanceCents: 0, currency: 'EUR' } })),
          fetch('/api/summary/monthly?months=6').then(r => r.json()).catch(() => ({ data: [] })),
          fetch('/api/summary/categories').then(r => r.json()).catch(() => ({ data: [] })),
          fetch('/api/transactions?limit=8').then(r => r.json()).catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;
        setBalance((balanceRes as BalanceResp).data);
        setMonthly((monthlyRes as MonthlyResp).data);
        setCats((catsRes as CategoriesResp).data);
        setRecent((recentRes as { data: Tx[] }).data || []);
      } catch (err) {
        console.error('[dashboard] load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const onUpdate = () => load();
    window.addEventListener('nimbus:data-updated', onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener('nimbus:data-updated', onUpdate);
    };
  }, []);

  const fmt = (cents: number) => `${(cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`;

  const donutData = cats
    .filter(c => c.category && c.category !== 'Income')
    .map(c => ({ name: c.category || 'Other', value: Math.abs(c.amountCents) }))
    .filter(d => d.value > 0);

  const income6M = monthly.reduce((a, b) => a + (b.incomeCents || 0), 0);
  const expense6M = monthly.reduce((a, b) => a + (b.expenseCents || 0), 0);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl p-4 md:p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardBody>
                <div className="animate-pulse space-y-2">
                  <div className="h-4 w-24 bg-slate-200 rounded"></div>
                  <div className="h-8 w-32 bg-slate-200 rounded"></div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8 space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <Stat label="Saldo gesamt" value={fmt(balance.balanceCents)} />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat label="Einnahmen (6M)" value={fmt(income6M)} />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat label="Ausgaben (6M)" value={fmt(expense6M)} />
          </CardBody>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardBody>
            <div className="mb-3 text-slate-700 font-medium">Monatsüberblick (6M)</div>
            {monthly.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-sm text-slate-400">Keine Daten verfügbar.</div>
            ) : (
              <MonthBars data={monthly} />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="mb-3 text-slate-700 font-medium">Ausgaben nach Kategorien</div>
            {donutData.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-sm text-slate-400">Keine Daten verfügbar.</div>
            ) : (
              <Donut data={donutData} />
            )}
          </CardBody>
        </Card>
      </div>

      {/* Recent */}
      <Card>
        <CardBody>
          <div className="mb-4 text-slate-700 font-medium">Letzte Buchungen</div>
          <ul className="divide-y divide-slate-100">
            {recent.length === 0 ? (
              <li className="py-6 text-slate-400">Keine Daten. — lade eine CSV hoch!</li>
            ) : (
              recent.map(tx => (
                <li key={tx.id} className="py-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-slate-900">{tx.purpose || '—'}</div>
                    <div className="text-sm text-slate-500">{tx.bookingDate ? new Date(tx.bookingDate).toLocaleDateString('de-DE') : '—'}</div>
                  </div>
                  <div className={`font-medium tabular-nums ${(tx.amountCents ?? 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {fmt(tx.amountCents ?? 0)}
                  </div>
                </li>
              ))
            )}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
