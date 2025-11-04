import { useEffect, useMemo, useState } from "react";
import StatCard from "../components/ui/StatCard";
import ProgressPill from "../components/ui/ProgressPill";
import { ArrowDownRight, ArrowUpRight, PiggyBank, ShieldCheck, Wallet } from "lucide-react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

type Summary = {
  balanceCents: number;
  monthIncomeCents: number;
  monthExpenseCents: number;
  categories?: { name: string; amountCents: number }[];
  months?: { month: string; incomeCents: number; expenseCents: number }[];
  recent?: { date: string; purpose: string; category?: string; amountCents: number }[];
};

type Achievements = Array<{
  id: string;
  title: string;
  achieved: boolean;
  progress: number; // 0..100
  current?: number;
  target?: number;
}>;

const COLORS = ["#7aa2f7","#a6da95","#ee99a0","#eed49f","#8bd5ca","#c6a0f6","#f5bde6","#91d7e3"];

function money(cents: number) {
  return (cents/100).toLocaleString("de-DE", {style:"currency", currency:"EUR"});
}

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [achievements, setAchievements] = useState<Achievements>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async ()=>{
      try {
        // Fetch summary data
        const [balanceRes, monthlyRes, categoriesRes, transactionsRes] = await Promise.all([
          fetch("/api/summary/balance").then(r => r.json()).catch(() => null),
          fetch("/api/summary/monthly").then(r => r.json()).catch(() => null),
          fetch("/api/summary/categories").then(r => r.json()).catch(() => null),
          fetch("/api/transactions?limit=10").then(r => r.json()).catch(() => null),
        ]);

        const currentMonth = new Date().toISOString().slice(0, 7);
        const monthlyData = monthlyRes?.data || [];
        const currentMonthData = monthlyData.find((m: any) => m.month === currentMonth) || { incomeCents: 0, expenseCents: 0 };

        setSummary({
          balanceCents: balanceRes?.data?.balanceCents || 0,
          monthIncomeCents: currentMonthData.incomeCents || 0,
          monthExpenseCents: Math.abs(currentMonthData.expenseCents || 0),
          categories: categoriesRes?.data || [],
          months: monthlyData,
          recent: transactionsRes?.data?.map((t: any) => ({
            date: t.bookingDate || '',
            purpose: t.purpose || '',
            category: t.category || '',
            amountCents: t.amountCents || 0,
          })) || [],
        });

        const a = await fetch("/api/achievements").then(r => r.json()).catch(() => null);
        setAchievements(a?.data || a || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const topCats = useMemo(() => {
    const cats = summary?.categories ?? [];
    return cats
      .filter((c: any) => c.amountCents < 0)
      .sort((a: any, b: any) => Math.abs(b.amountCents) - Math.abs(a.amountCents))
      .slice(0, 6)
      .map((c: any) => ({ name: c.category || c.name || 'Unknown', value: Math.abs(c.amountCents) / 100 }));
  }, [summary]);

  const months = useMemo(() => {
    const arr = summary?.months ?? [];
    return arr.slice(-6).map((m: any) => ({
      name: m.month?.slice(5) || m.month || '',
      income: (m.incomeCents || 0) / 100,
      expense: Math.abs((m.expenseCents || 0) / 100),
    }));
  }, [summary]);

  return (
    <div style={{display:"flex", flexDirection:"column", gap:16}}>
      {/* First row: stats */}
      <div className="grid-cards">
        <div style={{gridColumn:"span 3"}}>
          <StatCard
            title="Saldo gesamt"
            value={summary ? money(summary.balanceCents) : "—"}
            hint={<span className="badge"><Wallet size={14}/> Aktueller Datenstand</span>}
          />
        </div>
        <div style={{gridColumn:"span 3"}}>
          <StatCard
            title="Einnahmen (akt. Monat)"
            value={summary ? money(summary.monthIncomeCents) : "—"}
            hint={<span className="badge"><ArrowDownRight size={14}/> Monatliche Zuflüsse</span>}
          />
        </div>
        <div style={{gridColumn:"span 3"}}>
          <StatCard
            title="Ausgaben (akt. Monat)"
            value={summary ? money(summary.monthExpenseCents) : "—"}
            hint={<span className="badge"><ArrowUpRight size={14}/> Monatliche Abflüsse</span>}
          />
        </div>
        <div style={{gridColumn:"span 3"}}>
          <StatCard
            title="CSV-Importe"
            value={<span>siehe Transaktionen</span>}
            hint={<span className="badge"><PiggyBank size={14}/> <a href="/import" style={{color:"inherit"}}>CSV hochladen</a></span>}
          />
        </div>
      </div>

      {/* Second row: charts */}
      <div className="grid-cards">
        <div className="panel" style={{gridColumn:"span 7", padding:16}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <h3 style={{margin:0, fontSize:16}}>Monatsüberblick (6M)</h3>
            <ProgressPill ok={true} label="Aktuell" />
          </div>
          <div style={{height:260}}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months}>
                <XAxis dataKey="name" stroke="var(--muted)"/>
                <Tooltip contentStyle={{background:"var(--panel-2)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:12}} />
                <Bar dataKey="income" fill="#22c55e" radius={[8,8,0,0]} />
                <Bar dataKey="expense" fill="#ef4444" radius={[8,8,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel" style={{gridColumn:"span 5", padding:16}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <h3 style={{margin:0, fontSize:16}}>Top Kategorien</h3>
            <ProgressPill ok={!!topCats?.length} label={`${topCats?.length || 0} sichtbar`} />
          </div>
          <div style={{height:260, display:"grid", gridTemplateColumns:"1fr 1fr", alignItems:"center"}}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={topCats} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90}>
                  {topCats?.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{display:"flex", flexDirection:"column", gap:8}}>
              {topCats?.map((c, i) => (
                <div key={i} style={{display:"flex", alignItems:"center", gap:8}}>
                  <span style={{width:10, height:10, borderRadius:999, background:COLORS[i%COLORS.length]}}/>
                  <span style={{flex:1}}>{c.name}</span>
                  <span style={{color:"var(--muted)"}}>{c.value.toLocaleString("de-DE", {style:"currency", currency:"EUR"})}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Third row: achievements & recent */}
      <div className="grid-cards">
        <div className="panel" style={{gridColumn:"span 5", padding:16}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <h3 style={{margin:0, fontSize:16}}>Erfolge</h3>
            <span className="badge"><ShieldCheck size={14}/> {achievements.filter(a=>a.achieved).length} erreicht</span>
          </div>
          <div style={{marginTop:12, display:"grid", gap:12}}>
            {achievements.slice(0,5).map(a => (
              <div key={a.id} className="panel-ghost" style={{padding:12, display:"flex", alignItems:"center", justifyContent:"space-between"}}>
                <div>
                  <div style={{fontWeight:600}}>{a.title}</div>
                  <div style={{color:"var(--muted)", fontSize:13}}>
                    {a.current != null && a.target != null ? `${a.current} / ${a.target}` : `${a.progress}%`}
                  </div>
                </div>
                <ProgressPill ok={a.achieved} label={a.achieved ? "Erreicht" : `${a.progress}%`} />
              </div>
            ))}
          </div>
        </div>

        <div className="panel" style={{gridColumn:"span 7", padding:16}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <h3 style={{margin:0, fontSize:16}}>Letzte Buchungen</h3>
            <a className="badge" href="/transactions">Alle anzeigen</a>
          </div>
          <div style={{marginTop:8, overflowX:"auto"}}>
            <table className="table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Verwendungszweck</th>
                  <th>Kategorie</th>
                  <th style={{textAlign:"right"}}>Betrag</th>
                </tr>
              </thead>
              <tbody>
                {(summary?.recent ?? []).slice(0,10).map((t, i) => (
                  <tr key={i}>
                    <td>{new Date(t.date).toLocaleDateString('de-DE')}</td>
                    <td style={{maxWidth:520, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{t.purpose}</td>
                    <td>{t.category || "-"}</td>
                    <td style={{textAlign:"right", color: t.amountCents<0 ? "var(--negative)" : "var(--positive)"}}>
                      {money(t.amountCents)}
                    </td>
                  </tr>
                ))}
                {(!summary?.recent || summary.recent.length === 0) && (
                  <tr><td colSpan={4} style={{color:"var(--muted)"}}>Keine Transaktionen vorhanden.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CTA row */}
      <div className="panel" style={{padding:16, display:"flex", alignItems:"center", justifyContent:"space-between"}}>
        <div>
          <div style={{fontWeight:700, fontSize:16}}>Bankdaten verbinden</div>
          <div style={{color:"var(--muted)", fontSize:13}}>Importiere CSV (ING, Commerzbank, Postbank, Deutsche Bank) oder nutze bald PSD2.</div>
        </div>
        <a className="cta" href="/import">Jetzt CSV importieren</a>
      </div>
    </div>
  );
}
