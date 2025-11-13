import React from 'react';
import { Link2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { TxMini } from '../../hooks/useDashboardData';
import { getCategoryMeta } from '../../lib/categories';
import { formatCurrency, formatDate } from '../../lib/format';

type RecentActivityMiniProps = {
  transactions: TxMini[];
  loading?: boolean;
};

export const RecentActivityMini: React.FC<RecentActivityMiniProps> = ({ transactions, loading }) => {
  const items = React.useMemo(() => transactions.slice(0, 5), [transactions]);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white px-5 py-5 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Neueste Aktivitäten</h2>
        <Link
          to="/transactions"
          className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-300 dark:hover:text-indigo-200"
        >
          Alle Transaktionen ansehen →
        </Link>
      </div>
      {loading ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Lade Transaktionen…</p>
      ) : !items.length ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Noch keine Transaktionen vorhanden.</p>
      ) : (
        <ul className="mt-4 space-y-2 text-sm">
          {items.map((tx, idx) => {
            const meta = getCategoryMeta(tx.category ?? undefined);
            const showInternal = Boolean(tx.isInternalTransfer || tx.transferLinkId);
            const rawMeta = (tx.metadata ?? undefined) as Record<string, unknown> | undefined;
            const reason =
              rawMeta && typeof rawMeta.paypalCategoryReason === 'string' ? (rawMeta.paypalCategoryReason as string) : null;
            return (
              <li key={tx.id ?? idx} className="grid grid-cols-[1fr_auto] items-center gap-3 py-2">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(tx.bookingDate ?? undefined)}
                  </p>
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {tx.payee || tx.purpose || tx.counterpart || '—'}
                  </p>
                  {tx.memo ? (
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{tx.memo}</p>
                  ) : null}
                  {reason ? (
                    <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      Regel:&nbsp;{reason}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <div
                    className={`text-sm font-semibold ${
                      tx.amount < 0 ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300'
                    }`}
                  >
                    {formatCurrency(tx.amount)}
                  </div>
                  {tx.category ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium bg-white/80 dark:bg-slate-900/40"
                      style={{ borderColor: meta.color, color: meta.color }}
                    >
                      {showInternal ? <Link2 className="h-3 w-3" /> : null}
                      {meta.label}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};


