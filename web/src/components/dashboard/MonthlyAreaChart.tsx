import React from "react";
import { formatEuro } from "../../lib/format";

type Point = { month: string; incomeCents: number; expenseCents: number };

export function MonthlyAreaChart({ series }: { series: Point[] }) {
  if (!series?.length) {
    return <div className="text-sm text-zinc-500 dark:text-zinc-400">Keine Daten für den Zeitraum.</div>;
  }

  // very simple inline "chart": income vs expense as two polylines
  const w = 640, h = 180, pad = 24;
  const xs = series.map((_, i) => pad + i * ((w - pad*2) / Math.max(1, series.length - 1)));
  const maxVal = Math.max(...series.map(s => Math.max(s.incomeCents, s.expenseCents, 1)));
  const incomeY = (v:number) => h - pad - (v / maxVal) * (h - pad*2);
  const expenseY = (v:number) => h - pad - (v / maxVal) * (h - pad*2);

  const incomePoints = series.map((s, i) => `${xs[i]},${incomeY(s.incomeCents)}`).join(" ");
  const expensePoints = series.map((s, i) => `${xs[i]},${expenseY(s.expenseCents)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[200px]">
      <rect x={0} y={0} width={w} height={h} rx={12} className="fill-zinc-50 dark:fill-zinc-900" />
      <polyline points={incomePoints} fill="none" stroke="currentColor" strokeOpacity={0.9} strokeWidth={2} className="text-emerald-500" />
      <polyline points={expensePoints} fill="none" stroke="currentColor" strokeOpacity={0.9} strokeWidth={2} className="text-rose-500" />
      {/* simple labels */}
      <text x={pad} y={pad} className="text-[10px] fill-zinc-500">Max: {formatEuro(maxVal)}</text>
    </svg>
  );
}

