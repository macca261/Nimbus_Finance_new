import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Overview from './pages/Overview'
import UploadCSV from './pages/UploadCSV'
import Import from './pages/Import'
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

        if (!cancelled) {
          setStatus({ health, count })
          const statusEl = document.getElementById('api-status')
          if (statusEl) statusEl.textContent = health
        }
      } catch {
        if (!cancelled) {
          setStatus(prev => ({ ...prev, health: 'offline' }))
          const statusEl = document.getElementById('api-status')
          if (statusEl) statusEl.textContent = 'offline'
        }
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

  return (
    <>
      <Routes>
        <Route path="/" element={<Overview/>} />
        <Route path="/upload" element={<UploadCSV/>} />
        <Route path="/import" element={<Import/>} />
        <Route path="/transactions" element={<TransactionsPage/>} />
        <Route path="*" element={<div>Not found</div>} />
      </Routes>
      <ToastContainer />
    </>
  )
}


