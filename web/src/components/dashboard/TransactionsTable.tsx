import React from "react";
import { formatEuro } from "../../lib/format";

type Tx = { id?: string|number; bookingDate: string; purpose: string; amountCents: number; category?: string };

export function TransactionsTable({ rows }: { rows: Tx[] }) {
  if (!rows?.length) {
    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        Noch keine Daten. Lade eine CSV hoch, um zu starten.
      </div>
    );
  }
  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-zinc-500 dark:text-zinc-400">
          <tr>
            <th className="py-2 pr-3">Datum</th>
            <th className="py-2 pr-3">Verwendungszweck</th>
            <th className="py-2 pr-3">Kategorie</th>
            <th className="py-2 text-right">Betrag</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? i} className="border-t border-zinc-200/70 dark:border-zinc-800/80">
              <td className="py-2 pr-3 text-zinc-900 dark:text-zinc-100">{new Date(r.bookingDate).toLocaleDateString('de-DE')}</td>
              <td className="py-2 pr-3 text-zinc-900 dark:text-zinc-100">{r.purpose}</td>
              <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-400">{r.category ?? "-"}</td>
              <td className={`py-2 text-right tabular-nums ${r.amountCents < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {formatEuro(r.amountCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

