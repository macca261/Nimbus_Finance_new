import React from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { RightPanel } from "./RightPanel";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="flex">
        <Sidebar />

        <div className="flex-1 min-w-0">
          <Topbar />
          <main className="max-w-7xl mx-auto px-4 md:px-6 py-6">
            {children}
          </main>
        </div>

        {/* Right-side AI panel (collapsible if needed) */}
        <RightPanel />
      </div>
    </div>
  );
}

