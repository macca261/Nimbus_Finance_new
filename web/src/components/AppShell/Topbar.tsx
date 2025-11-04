import { useState } from "react";
import { Bot, Link2 } from "lucide-react";

export default function Topbar({ onToggleAI }: { onToggleAI: () => void }) {
  const [apiState, setApiState] = useState<"ok"|"offline">("ok"); // can toggle based on a /health ping

  return (
    <div className="topbar">
      <div style={{display:"flex", alignItems:"center", gap:12, padding:"10px 16px"}}>
        <span className="badge">
          API: {apiState}
        </span>
        <div style={{marginLeft:"auto", display:"flex", gap:8}}>
          <button className="cta" onClick={onToggleAI}><Bot size={18}/> Fragen an KI</button>
          <a className="cta" href="/import"><Link2 size={18}/> Bank verbinden</a>
        </div>
      </div>
    </div>
  );
}

