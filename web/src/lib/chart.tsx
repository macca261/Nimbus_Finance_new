import React from 'react'

type PieDatum = { label: string; value: number; color?: string }
type BarDatum = { label: string; value: number; color?: string }

export function PieChart({ data = [] as PieDatum[] }: { data: PieDatum[] }) {
  const total = data.reduce((a, b) => a + Math.max(0, b.value), 0) || 1
  let acc = 0
  const radius = 60
  const cx = 70, cy = 70
  const slices = data.map((d, i) => {
    const v = Math.max(0, d.value)
    const angle = (v / total) * Math.PI * 2
    const x1 = cx + radius * Math.cos(acc)
    const y1 = cy + radius * Math.sin(acc)
    acc += angle
    const x2 = cx + radius * Math.cos(acc)
    const y2 = cy + radius * Math.sin(acc)
    const largeArc = angle > Math.PI ? 1 : 0
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`
    const color = d.color || defaultColor(i)
    return <path key={i} d={path} fill={color} />
  })
  return (
    <div style={{ width: '100%', maxWidth: 320 }}>
      <svg viewBox="0 0 140 140" style={{ width: '100%', height: 'auto' }}>{slices}</svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, background: d.color || defaultColor(i), display: 'inline-block', borderRadius: 2 }} />
            {d.label}
          </div>
        ))}
      </div>
    </div>
  )
}

export function BarChart({ data = [] as BarDatum[] }: { data: BarDatum[] }) {
  const max = data.reduce((m, d) => Math.max(m, Math.abs(d.value)), 0) || 1
  return (
    <div style={{ width: '100%', maxWidth: 540 }}>
      <svg viewBox="0 0 100 60" style={{ width: '100%', height: 'auto' }}>
        {data.map((d, i) => {
          const h = (Math.abs(d.value) / max) * 50
          const x = i * (100 / data.length)
          const w = (90 / data.length)
          const y = 55 - h
          const color = d.color || defaultColor(i)
          return <g key={i}>
            <rect x={x + 2} y={y} width={w} height={h} fill={color} rx={1.5} />
            <text x={x + 2 + w / 2} y={59} fontSize={4} textAnchor="middle">{d.label}</text>
          </g>
        })}
      </svg>
    </div>
  )
}

function defaultColor(i: number) {
  const palette = ['#6366F1','#22C55E','#F59E0B','#EF4444','#14B8A6','#8B5CF6','#3B82F6','#F97316']
  return palette[i % palette.length]
}


