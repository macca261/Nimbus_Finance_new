import { useState } from "react";

export default function AIDrawer({ open, onClose }: {open: boolean; onClose: () => void}) {
  const [input, setInput] = useState("");

  return (
    <div style={{
      position:"fixed", top:0, right:0, bottom:0, width: open ? 420 : 0,
      background:"var(--panel)", borderLeft:"1px solid rgba(255,255,255,0.08)",
      boxShadow:"-20px 0 40px rgba(0,0,0,0.35)", overflow:"hidden",
      transition:"width .25s ease"
    }}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:16, borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
        <div style={{fontWeight:700}}>Nimbus KI</div>
        <button onClick={onClose} className="badge">Schließen</button>
      </div>
      <div style={{padding:16, display:"flex", flexDirection:"column", height:"calc(100% - 112px)", gap:12}}>
        <div className="panel" style={{flex:1, padding:12, overflowY:"auto"}}>
          <div style={{color:"var(--muted)", fontSize:13}}>
            Frag etwas wie: <i>„Warum ist mein Saldo negativ?"</i> oder <i>„Zeig mir größte Ausgaben im Oktober."</i>
          </div>
          {/* TODO: messages list */}
        </div>
        <form onSubmit={(e)=>{e.preventDefault(); /* TODO call backend */ setInput("");}}>
          <div style={{display:"flex", gap:8}}>
            <input
              value={input}
              onChange={e=>setInput(e.target.value)}
              placeholder="Deine Frage…"
              style={{flex:1, background:"var(--panel-2)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, padding:"10px 12px", color:"var(--text)"}}
            />
            <button className="cta" type="submit">Senden</button>
          </div>
        </form>
      </div>
    </div>
  );
}

