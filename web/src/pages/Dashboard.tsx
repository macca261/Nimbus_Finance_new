import { useEffect, useMemo, useState } from 'react'
import { PieChart, BarChart } from '../lib/chart'
import { apiSummary, apiDev } from '../lib/api'
import TrophiesPanel from '../components/TrophiesPanel'

type Tx = { id?: string; bookingDate?: string; purpose?: string; amountCents?: number; currency?: string }

export default function Dashboard() {
  const [recent, setRecent] = useState<Tx[]>([])
  const [balance, setBalance] = useState<number>(0)
  const [incomeMTD, setIncomeMTD] = useState<number>(0)
  const [expenseMTD, setExpenseMTD] = useState<number>(0)
  const [catEntries, setCatEntries] = useState<{ category: string; sumCents: number; count?: number }[]>([])
  const [monthly, setMonthly] = useState<{ label: string; incomeCents: number; expenseCents: number }[]>([])
  const [baseMonth, setBaseMonth] = useState<string | null>(null)
  const [apiOk, setApiOk] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fmt = (cents?: number, cur='EUR') =>
    (typeof cents === 'number')
      ? (cents/100).toLocaleString('de-DE', { style:'currency', currency: cur })
      : '—'

  useEffect(() => {
    let cancelled = false
    const reloadAll = async () => {
      try {
        const [txsResp, balResp, monsResp, health] = await Promise.all([
          fetch('/api/transactions?limit=10').then(r => r.json()).catch(() => ({ data: [] })),
          apiSummary.balance().catch(() => ({ balanceCents: 0, currency: 'EUR' })),
          apiSummary.months6().catch(() => ({ baseMonth: null, series: [] })),
          fetch('/api/health').then(r => r.json()).catch(() => ({ ok: false })),
        ])
        if (cancelled) return
        setRecent(Array.isArray(txsResp?.data) ? (txsResp.data as any[]) : [])
        setBalance((balResp?.balanceCents as number) ?? 0)
        setApiOk(Boolean(health?.ok))
        setBaseMonth(monsResp?.baseMonth ?? null)
        setMonthly(Array.isArray(monsResp?.series) ? monsResp.series : [])
        try {
          const m = await apiSummary.month(monsResp?.baseMonth ?? undefined)
          setIncomeMTD(m.incomeCents ?? 0)
          setExpenseMTD(m.expenseCents ?? 0)
        } catch {}
        try {
          const catsResp = await apiSummary.categories()
          const items = (catsResp?.items ?? []).filter(i => typeof i.spendCents === 'number').sort((a, b) => (b.spendCents ?? 0) - (a.spendCents ?? 0))
          const top = items.slice(0, 6)
          const rest = items.slice(6)
          const restSum = rest.reduce((acc, item) => acc + (item.spendCents ?? 0), 0)
          const merged = [...top]
          if (restSum > 0) merged.push({ category: 'Other', spendCents: restSum })
          setCatEntries(merged.map(i => ({ category: i.category, sumCents: i.spendCents ?? 0 })))
        } catch {}
        setError(null)
      } catch {
        if (!cancelled) setError('Fehler beim Laden der Übersicht.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    reloadAll()
    const onUpdate = () => { setLoading(true); reloadAll() }
    window.addEventListener('nimbus:data-updated', onUpdate)
    return () => { cancelled = true; window.removeEventListener('nimbus:data-updated', onUpdate) }
  }, [])

  const money = (n: number) => (n/100).toLocaleString('de-DE', { style:'currency', currency: 'EUR' })
  const pieData = useMemo(() => (catEntries || [])
    .filter(e => (e.category || 'Other') !== 'Income')
    .map(e => ({ label: e.category || 'Other', value: Math.max(0, e.sumCents) })), [catEntries])
  const barData = useMemo(() => (monthly || []).map(m => ({ label: m.label, value: Math.abs(m.expenseCents) })), [monthly])

  if (loading) return <div>Laden…</div>
  return (
    <div>
      <h1 style={{ display:'flex', alignItems:'center', gap: 8 }}>
        Nimbus Finance
        <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 999, background: apiOk ? '#dcfce7' : '#e5e7eb', color: apiOk ? '#065f46' : '#374151' }}>
          API: {apiOk ? 'ok' : 'offline'}
        </span>
      </h1>
      {error && <div style={{ fontSize: 12, color:'#b91c1c', marginTop: 6 }}>Fehler beim Laden der Übersicht.</div>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginTop: 12 }}>
        <Kpi title="Saldo gesamt" value={money(balance)} />
        <Kpi title={`Einnahmen (${baseMonth ?? 'Monat'})`} value={money(incomeMTD)} />
        <Kpi title={`Ausgaben (${baseMonth ?? 'Monat'})`} value={money(expenseMTD)} />
      </div>

      <div style={{ marginTop: 12 }}>
        <TrophiesPanel />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 16, marginTop: 16 }}>
        <div>
          <h3>Ausgaben nach Kategorien</h3>
          {pieData.length === 0 ? <div style={{ fontSize: 12, opacity: .7 }}>Keine Daten.</div> : <PieChart data={pieData} />}
        </div>
        <div>
          <h3>Monatsüberblick (6M)</h3>
          {barData.length === 0 ? <div style={{ fontSize: 12, opacity: .7 }}>Keine Daten.</div> : <BarChart data={barData} />}
        </div>
      </div>

      {import.meta.env.DEV && (
        <div style={{ marginTop: 12 }}>
          <button onClick={async () => { await apiDev.reset(); location.reload(); }}>Daten zurücksetzen</button>
        </div>
      )}

      <h3 style={{ marginTop: 16 }}>Letzte Buchungen</h3>
      <ul style={{paddingLeft:16}}>
        {recent.map((t, i) => (
          <li key={t.id ?? i}>
            {t.bookingDate ?? '—'} · {t.purpose ?? '—'} · <strong>{fmt(t.amountCents, t.currency)}</strong>
          </li>
        ))}
        {recent.length === 0 && <li>Keine Daten. Lade eine CSV hoch.</li>}
      </ul>
    </div>
  )
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <div style={{ fontSize: 12, opacity: .7 }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 600 }}>{value}</div>
    </div>
  )
}


