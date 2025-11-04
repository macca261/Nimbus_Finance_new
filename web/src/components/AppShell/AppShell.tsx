import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import AIDrawer from "./AIDrawer";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <div style={{display:"grid", gridTemplateColumns:"260px 1fr", minHeight:"100vh"}}>
      <Sidebar />
      <div style={{display:"flex", flexDirection:"column", minWidth:0}}>
        <Topbar onToggleAI={() => setAiOpen(v => !v)} />
        <main style={{padding:24, width:"100%", maxWidth:1400}}>
          {children}
        </main>
      </div>
      <AIDrawer open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}

