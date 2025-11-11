import type { DashboardSummary } from '../../api/dashboard';
import { formatCurrency, formatDate } from '../../lib/format';

type RecentTransactionsTableProps = {
  rows: DashboardSummary['recentTransactions'];
};

export function RecentTransactionsTable({ rows }: RecentTransactionsTableProps) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Noch keine Transaktionen importiert.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <h3 className="text-base font-semibold text-slate-800">Letzte Transaktionen</h3>
        <span className="text-xs uppercase tracking-wide text-slate-500">Top {rows.length}</span>
      </div>
      <div className="max-h-[480px] overflow-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-slate-600">
              <th className="px-4 py-3 text-left font-medium">Datum</th>
              <th className="px-4 py-3 text-left font-medium">Kategorie</th>
              <th className="px-4 py-3 text-left font-medium">Gegenpartei</th>
              <th className="px-4 py-3 text-left font-medium">Verwendungszweck</th>
              <th className="px-4 py-3 text-right font-medium">Betrag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map(row => (
              <tr key={row.id} className="text-slate-700">
                <td className="whitespace-nowrap px-4 py-3">{formatDate(row.bookedAt ?? undefined)}</td>
                <td className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500">
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">
                    {row.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <span className="line-clamp-1">{row.counterpart ?? '—'}</span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <span className="line-clamp-1">{row.purpose ?? '—'}</span>
                </td>
                <td className={`whitespace-nowrap px-4 py-3 text-right ${row.amount < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                  {formatCurrency(row.amount, row.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


