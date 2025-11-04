import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

type ToastState = { type: 'success' | 'error'; message: string }

export default function UploadCSV() {
  const [msg, setMsg] = useState<string>('Noch nichts hochgeladen.')
  const [toast, setToast] = useState<ToastState | null>(null)
  const [lastSuccess, setLastSuccess] = useState<{ adapterId: string; imported: number; duplicates: number } | null>(null)
  const timeoutRef = useRef<number>()

  useEffect(() => () => { if (timeoutRef.current) window.clearTimeout(timeoutRef.current) }, [])

  const dismissToast = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    setToast(null)
  }

  const showToast = (state: ToastState) => {
    dismissToast()
    setToast(state)
    timeoutRef.current = window.setTimeout(() => setToast(null), 5000)
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const fd = new FormData()
    fd.append('file', f)
    setMsg('Lade hoch…')
    setLastSuccess(null)
    try {
      const res = await fetch('/api/imports/csv', { method:'POST', body: fd })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const body = json || {};
        const message = body?.error || body?.message || res.statusText || 'Upload fehlgeschlagen';
        setMsg(message);
        if (body?._debug || body?.reason) {
          console.warn('[import:error]', body);
        }
        showToast({ type: 'error', message });
        return;
      }
      const body = json || {};
      const data = body?.data || body;
      const imported = data?.imported ?? data?.rows?.length ?? 0;
      const duplicates = data?.duplicates ?? 0;
      const adapterId = data?.adapterId ?? 'unbekannt';
      const successMsg = `Import erfolgreich – ${imported} Buchungen gespeichert, ${duplicates} Duplikate übersprungen.`;
      setMsg(successMsg);
      setLastSuccess({ adapterId, imported, duplicates });
      showToast({ type: 'success', message: successMsg });
      try { window.dispatchEvent(new Event('nimbus:data-updated')); } catch {}
    } catch (e:any) {
      const message = e?.message ?? 'Upload fehlgeschlagen'
      setMsg('Fehler: ' + message)
      showToast({ type: 'error', message })
    }
  }

  return (
    <div style={{ position:'relative' }}>
      {toast && (
        <div
          style={{
            position:'fixed',
            top:24,
            right:24,
            background: toast.type === 'success' ? '#16a34a' : '#dc2626',
            color:'#fff',
            padding:'12px 16px',
            borderRadius:8,
            boxShadow:'0 10px 30px rgba(15, 23, 42, 0.15)',
            fontSize:14,
            zIndex:40,
            maxWidth:360,
            display:'flex',
            alignItems:'center',
            gap:12
          }}
        >
          <span>{toast.message}</span>
          <button
            onClick={dismissToast}
            style={{ background:'transparent', border:'none', color:'#fff', fontSize:16, cursor:'pointer' }}
            aria-label="Hinweis schließen"
          >×</button>
        </div>
      )}
      <h2>CSV hochladen</h2>
      <input type="file" accept=".csv,.xml,text/csv,application/xml" onChange={onFileChange} />
      <p style={{marginTop:12, whiteSpace:'pre-wrap'}}>{msg}</p>
      {lastSuccess && (
        <div style={{ marginTop:16, fontSize:14 }}>
          <Link to="/" style={{ color:'#2563eb', textDecoration:'underline' }}>Zur Übersicht wechseln</Link>
        </div>
      )}
    </div>
  )
}


