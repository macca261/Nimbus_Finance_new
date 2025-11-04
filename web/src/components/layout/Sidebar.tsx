import React from "react";
import { NavLink } from "react-router-dom";

const nav = [
  { to: "/", label: "Übersicht", icon: "🏠" },
  { to: "/transactions", label: "Transaktionen", icon: "📄" },
  { to: "/upload", label: "CSV hochladen", icon: "⬆️" },
  { to: "/import", label: "Bank Import (DE)", icon: "🏦" },
  { to: "/goals", label: "Ziele", icon: "🎯" },
  { to: "/categories", label: "Kategorien", icon: "📊" },
  { to: "/settings", label: "Einstellungen", icon: "⚙️" },
];

export function Sidebar() {
  return (
    <aside className="hidden md:flex md:flex-col w-64 border-r border-zinc-200/70 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/40 backdrop-blur supports-[backdrop-filter]:bg-white/40 sticky top-0 h-screen">
      <div className="px-4 py-4 text-xl font-bold">Nimbus Finance</div>
      <nav className="px-2 pb-4 space-y-1 overflow-auto">
        {nav.map(n => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition
               ${isActive ? "bg-indigo-600 text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`
            }
          >
            <span>{n.icon}</span> <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto p-3 text-xs text-zinc-500">
        API:&nbsp;<span id="api-status">ok</span>
      </div>
    </aside>
  );
}
