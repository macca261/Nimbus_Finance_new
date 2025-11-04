import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function UploadCSV() {
  const [msg, setMsg] = useState<string>('Noch nichts hochgeladen.')
  const navigate = useNavigate()

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const fd = new FormData()
    fd.append('file', f)
    setMsg('Lade hoch…')
    try {
      const res = await fetch('/api/imports/csv', { method:'POST', body: fd })
      const json = await res.json()
      if (!res.ok) {
        const message = json?.message || res.statusText || 'Upload fehlgeschlagen'
        const pv = json?.preview
        const preview = pv ? `\n\nVorschau:\n${pv.header}\n${pv.firstDataLine}` : ''
        setMsg(`Fehler: ${message}${preview}`)
        return
      }
      const data = json?.data || json
      setMsg(`Import erfolgreich: adapterId=${data.adapterId} · imported=${data.imported ?? data.rows?.length ?? 0} · duplicates=${data.duplicates ?? 0}`)
      try { window.dispatchEvent(new Event('nimbus:data-updated')); } catch {}
      setTimeout(() => navigate('/?r=' + Date.now()), 250)
    } catch (e:any) {
      setMsg('Fehler: ' + (e?.message ?? 'Upload fehlgeschlagen'))
    }
  }

  return (
    <div>
      <h2>CSV hochladen</h2>
      <input type="file" accept=".csv,.xml,text/csv,application/xml" onChange={onFileChange} />
      <p style={{marginTop:12}}>{msg}</p>
    </div>
  )
}


