import Ring from './Ring'
import type { Achievement } from '@/lib/api'

const currencyFmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

type Props = {
  items: Achievement[]
  loading?: boolean
  monthLabel?: string | null
  error?: string | null
}

const ORDER: Achievement['id'][] = ['saver-500', 'groceries-under-200', 'no-fees', 'streak-7']

export default function TrophiesPanel({ items = [], loading = false, monthLabel, error }: Props) {
  if (error) return <div className="text-sm text-slate-500">{error}</div>
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl border border-slate-100 bg-[var(--surface-muted)]" />
        ))}
      </div>
    )
  }

  const ordered = ORDER.map(id => items.find(a => a.id === id)).filter(Boolean) as Achievement[]
  if (!ordered.length) return <div className="text-sm text-slate-500">Noch keine Erfolge – lade eine CSV hoch!</div>

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Erfolge</h3>
        {monthLabel && <span className="text-xs font-medium text-slate-500">{monthLabel}</span>}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ordered.map(item => {
          const tone = item.achieved ? 'border-emerald-200 bg-[var(--surface-success)] text-emerald-900' : 'border-slate-200 bg-white text-slate-900'
          const ringColor = item.achieved ? 'var(--ring-success)' : 'var(--ring-info)'
          return (
            <div
              key={item.id}
              className={`flex items-center justify-between gap-3 rounded-2xl border shadow-sm px-4 py-3 ${tone}`}
            >
              <div className="space-y-1">
                <p className="text-sm font-semibold leading-tight">{item.title}</p>
                <p className="text-xs text-slate-600">{item.description}</p>
                {renderHint(item)}
              </div>
              <Ring percent={item.progress} color={ringColor} trackColor="var(--surface-muted)">
                {item.achieved ? '✓' : `${Math.round(Math.max(0, Math.min(100, item.progress)))}%`}
              </Ring>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function renderHint(item: Achievement) {
  let text: string | null = null
  if (item.id === 'saver-500') {
    const current = typeof item.current === 'number' ? currencyFmt.format(item.current) : '—'
    const target = typeof item.target === 'number' ? currencyFmt.format(item.target) : currencyFmt.format(500)
    text = `Sparen: ${current} / ${target}`
  } else if (item.id === 'groceries-under-200') {
    const current = typeof item.current === 'number' ? currencyFmt.format(item.current) : '—'
    const target = typeof item.target === 'number' ? currencyFmt.format(item.target) : currencyFmt.format(200)
    text = `Lebensmittel: ${current} / ${target}`
  } else if (item.id === 'streak-7') {
    const current = typeof item.current === 'number' ? item.current : 0
    const target = typeof item.target === 'number' ? item.target : 7
    text = `Aktive Tage: ${current} / ${target}`
  } else if (item.id === 'no-fees') {
    text = item.achieved ? 'Keine Gebühren 🎉' : 'Gebühren entdeckt'
  }
  if (!text) return null
  return <p className="text-xs text-slate-600">{text}</p>
}
