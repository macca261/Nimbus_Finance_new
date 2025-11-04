import React from "react";
import { Link } from "react-router-dom";

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 bg-white/70 dark:bg-zinc-900/40 backdrop-blur supports-[backdrop-filter]:bg-white/40 border-b border-zinc-200/70 dark:border-zinc-800/80">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Übersicht</h1>
          <span className="hidden sm:inline text-sm text-zinc-500 dark:text-zinc-400">
            Dein finanzieller Überblick
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/upload" className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700">
            CSV hochladen
          </Link>
        </div>
      </div>
    </header>
  );
}

