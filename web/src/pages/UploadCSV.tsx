import { useState } from 'react'

export default function UploadCSV() {
  const [msg, setMsg] = useState<string>('Noch nichts hochgeladen.')

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const fd = new FormData()
    fd.append('file', f)
    setMsg('Lade hoch…')
    try {
      const res = await fetch('/api/imports/csv', { method:'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.message || res.statusText)
      setMsg(`Import erfolgreich: adapterId=${json.adapterId} · imported=${json.imported ?? json.rows?.length ?? 0} · duplicates=${json.duplicates ?? 0}`)
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


