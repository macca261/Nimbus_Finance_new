import { NavLink } from "react-router-dom";
import { LayoutDashboard, Upload, ListOrdered, Target, Tags, Settings, Bot } from "lucide-react";

export default function Sidebar() {
  const nav = [
    { to: "/", label: "Übersicht", icon: <LayoutDashboard size={18} /> },
    { to: "/transactions", label: "Transaktionen", icon: <ListOrdered size={18} /> },
    { to: "/import", label: "CSV hochladen", icon: <Upload size={18} /> },
    { to: "/goals", label: "Ziele", icon: <Target size={18} /> },
    { to: "/categories", label: "Kategorien", icon: <Tags size={18} /> },
    { to: "/settings", label: "Einstellungen", icon: <Settings size={18} /> },
  ];

  return (
    <aside className="sidebar" style={{padding:16, display:"flex", flexDirection:"column", gap:12}}>
      <div style={{fontWeight:800, fontSize:18, letterSpacing:.2}}>Nimbus Finance</div>
      <div style={{display:"flex", flexDirection:"column", gap:6}}>
        {nav.map(i => (
          <NavLink
            key={i.to}
            to={i.to}
            className={({isActive}) => "nav-item" + (isActive ? " active" : "")}
          >
            {i.icon}
            <span>{i.label}</span>
          </NavLink>
        ))}
      </div>
      <div style={{marginTop:"auto"}}>
        <div className="panel" style={{padding:12, display:"flex", alignItems:"center", justifyContent:"space-between", borderRadius:12}}>
          <div style={{fontSize:13, color:"var(--muted)"}}>AI Assistent</div>
          <div title="Open AI panel"><Bot size={18} /></div>
        </div>
      </div>
    </aside>
  );
}

