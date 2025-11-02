import { useEffect, useState } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import UploadCSV from './pages/UploadCSV'
import TransactionsPage from './pages/Transactions'

export default function App() {
  const [health, setHealth] = useState<string>('checking...')
  useEffect(() => {
    fetch('/api/health')
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(j => setHealth('ok'))
      .catch(() => setHealth('offline'))
  }, [])

  return (
    <div style={{fontFamily:'Inter, system-ui, Arial', padding:16}}>
      <header style={{display:'flex', gap:16, alignItems:'center', marginBottom:16}}>
        <h1 style={{margin:0}}>Nimbus Finance</h1>
        <nav style={{display:'flex', gap:12}}>
          <Link to="/">Übersicht</Link>
          <Link to="/transactions">Transaktionen</Link>
          <Link to="/upload">CSV hochladen</Link>
        </nav>
        <span style={{marginLeft:'auto', fontSize:12, opacity:0.7}}>API: {health}</span>
      </header>
      <Routes>
        <Route path="/" element={<Dashboard/>} />
        <Route path="/upload" element={<UploadCSV/>} />
        <Route path="/transactions" element={<TransactionsPage/>} />
        <Route path="*" element={<div>Not found</div>} />
      </Routes>
    </div>
  )
}


