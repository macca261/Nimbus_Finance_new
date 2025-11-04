import React from "react";

export function RightPanel() {
  // For now: static placeholder for upcoming AI Q&A
  return (
    <aside className="hidden xl:flex xl:flex-col w-[380px] border-l border-zinc-200/70 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/40 backdrop-blur supports-[backdrop-filter]:bg-white/40 sticky top-0 h-screen">
      <div className="px-4 py-4 text-sm font-semibold">AI Assistent</div>
      <div className="p-4 text-sm text-zinc-600 dark:text-zinc-400">
        Stelle Fragen wie:<br/>
        • „Warum ist mein Saldo negativ?"<br/>
        • „Was war meine größte Ausgabe im Oktober?"<br/><br/>
        <div className="mt-2 rounded-lg border border-zinc-200/70 dark:border-zinc-800/80 p-3">
          <textarea
            placeholder="Frag mich alles über deine Finanzen…"
            className="w-full bg-transparent outline-none placeholder:text-zinc-400 text-sm resize-none"
            rows={4}
          />
          <button className="mt-3 w-full py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700">
            Fragen
          </button>
        </div>
      </div>
    </aside>
  );
}

