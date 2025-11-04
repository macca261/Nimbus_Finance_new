import React from "react";
import { formatEuro } from "../../lib/format";

type Row = { category: string; amountCents: number };

export function TopCategoriesList({ rows }: { rows: Row[] }) {
  if (!rows?.length) return <div className="text-sm text-zinc-500 dark:text-zinc-400">Noch keine Ausgaben kategorisiert.</div>;

  const max = Math.max(...rows.map(r => Math.abs(r.amountCents)));
  return (
    <div className="space-y-3">
      {rows.slice(0, 5).map((r) => {
        const w = Math.max(8, (Math.abs(r.amountCents) / max) * 100);
        return (
          <div key={r.category}>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-900 dark:text-zinc-100">{r.category}</span><span className="text-zinc-500 dark:text-zinc-400">{formatEuro(Math.abs(r.amountCents))}</span>
            </div>
            <div className="h-2 bg-zinc-200/70 dark:bg-zinc-800/80 rounded">
              <div className="h-2 bg-indigo-500 rounded" style={{ width: `${w}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

