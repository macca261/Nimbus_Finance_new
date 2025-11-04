import React, { useEffect, useMemo, useState } from 'react'
import { AchievementDto, getAchievements } from '@/lib/api'
import TrophyDrawer from './TrophyDrawer'

function TierIcon({ tier }: { tier: 'bronze'|'silver'|'gold' }) {
  const color = tier==='gold' ? '#f59e0b' : tier==='silver' ? '#9ca3af' : '#b45309'
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill={color}><circle cx="12" cy="12" r="10" /></svg>
  )
}

function ProgressRing({ value=0 }: { value: number }) {
  const r=18, c=2*Math.PI*r, off=c*(1-Math.min(1,Math.max(0,value/100)))
  return (
    <svg width={48} height={48} viewBox="0 0 48 48">
      <circle cx={24} cy={24} r={r} stroke="#eee" strokeWidth={4} fill="none" />
      <circle cx={24} cy={24} r={r} stroke="#10b981" strokeWidth={4} fill="none" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 24 24)" />
      <text x="24" y="27" textAnchor="middle" fontSize={10}>{Math.round(value)}%</text>
    </svg>
  )
}

export default function TrophiesPanel() {
  const [items, setItems] = useState<AchievementDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<AchievementDto | undefined>(undefined)

  useEffect(() => {
    getAchievements().then(r => setItems(r.data || [])).catch(() => setError('Achievements nicht verfügbar.'))
  }, [])

  const unlocked = useMemo(() => (items||[]).filter(a => a.unlocked).sort((a,b) => tierScore(b)-tierScore(a)), [items])
  const inProgress = useMemo(() => (items||[]).filter(a => !a.unlocked).sort((a,b) => (b.progress)-(a.progress)), [items])

  if (error) return <div style={{ fontSize:12, opacity:.7 }}>{error}</div>
  if (items === null) return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
      {Array.from({length:3}).map((_,i)=>(<div key={i} style={{ border:'1px solid #eee', borderRadius:8, padding:12, background:'#f9fafb', height:90 }} />))}
    </div>
  )
  if ((items||[]).length===0) return <div style={{ fontSize:12, opacity:.7 }}>Noch keine Erfolge — lade eine CSV hoch!</div>

  const renderCard = (a: AchievementDto) => (
    <div key={a.code} onClick={()=>{ setSelected(a); setOpen(true) }} style={{ border:'1px solid #eee', borderRadius:8, padding:12, display:'flex', gap:12, cursor:'pointer' }}>
      <TierIcon tier={a.tier} />
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:600, fontSize:14 }}>{a.title}</div>
        <div style={{ fontSize:12, color:'#555' }}>{a.description}</div>
      </div>
      <ProgressRing value={a.progress} />
    </div>
  )

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
        {unlocked.slice(0,3).map(renderCard)}
        {inProgress.map(renderCard)}
      </div>
      <TrophyDrawer open={open} onClose={()=>setOpen(false)} item={selected} />
    </div>
  )
}

function tierScore(a: AchievementDto) { return a.tier==='gold' ? 3 : a.tier==='silver' ? 2 : 1 }


