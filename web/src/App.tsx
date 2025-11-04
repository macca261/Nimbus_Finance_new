import { useEffect, useState } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import UploadCSV from './pages/UploadCSV'
import TransactionsPage from './pages/Transactions'
import { ToastContainer } from './lib/toast'

type StatusState = {
  health: string
  count: number | null
}

export default function App() {
  const [status, setStatus] = useState<StatusState>({ health: 'checking...', count: null })

  useEffect(() => {
    let cancelled = false

    const fetchStatus = async () => {
      try {
        const [healthRes, statsRes] = await Promise.all([
          fetch('/api/health'),
          fetch('/api/debug/stats'),
        ])

        let health = 'offline'
        if (healthRes.ok) {
          const hJson = await healthRes.json().catch(() => null)
          health = hJson?.ok ? 'ok' : 'offline'
        }

        let count: number | null = null
        if (statsRes.ok) {
          const sJson = await statsRes.json().catch(() => null)
          count = typeof sJson?.data?.count === 'number' ? sJson.data.count : null
        }

        if (!cancelled) setStatus({ health, count })
      } catch {
        if (!cancelled) setStatus(prev => ({ ...prev, health: 'offline' }))
      }
    }

    fetchStatus()
    let interval: number | undefined
    if (import.meta.env.DEV) {
      interval = window.setInterval(fetchStatus, 30000)
    }
    return () => {
      cancelled = true
      if (interval) window.clearInterval(interval)
    }
  }, [])

  const statusLabel = status.count != null
    ? `API: ${status.health} • TX: ${status.count}`
    : `API: ${status.health}`

  return (
    <div style={{fontFamily:'Inter, system-ui, Arial', padding:16}}>
      <header style={{display:'flex', gap:16, alignItems:'center', marginBottom:16}}>
        <h1 style={{margin:0}}>Nimbus Finance</h1>
        <nav style={{display:'flex', gap:12}}>
          <Link to="/">Übersicht</Link>
          <Link to="/transactions">Transaktionen</Link>
          <Link to="/upload">CSV hochladen</Link>
        </nav>
        <span style={{marginLeft:'auto', fontSize:12, opacity:0.7}}>{statusLabel}</span>
      </header>
      <Routes>
        <Route path="/" element={<Dashboard/>} />
        <Route path="/upload" element={<UploadCSV/>} />
        <Route path="/transactions" element={<TransactionsPage/>} />
        <Route path="*" element={<div>Not found</div>} />
      </Routes>
      <ToastContainer />
    </div>
  )
}


