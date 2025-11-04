import React from 'react'
import type { AchievementDto } from '@/lib/api'

export default function TrophyDrawer({ open, onClose, item }: { open: boolean; onClose: () => void; item?: AchievementDto }) {
  if (!open || !item) return null
  return (
    <div style={{ position:'fixed', top:0, right:0, bottom:0, width:320, background:'#fff', boxShadow:'-2px 0 8px rgba(0,0,0,0.1)', padding:16, zIndex:50 }}>
      <button onClick={onClose} style={{ float:'right' }}>×</button>
      <h3 style={{ marginTop:8 }}>{item.title}</h3>
      <p style={{ fontSize:14, color:'#555' }}>{item.description}</p>
      <p style={{ fontSize:12, color:'#777' }}>Tier: {item.tier}</p>
      <p style={{ fontSize:12, color:'#777' }}>Status: {item.unlocked ? 'Freigeschaltet' : 'In Arbeit'}</p>
      <p style={{ fontSize:12, color:'#777' }}>Fortschritt: {item.progress}%</p>
      <div style={{ marginTop:12, fontSize:12, color:'#555' }}>Wie freischalten? Beobachte deine Ausgaben und lade regelmäßig CSVs hoch.</div>
    </div>
  )
}


