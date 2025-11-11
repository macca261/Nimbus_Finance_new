import { formatCurrency, formatDate } from '../../lib/format';
import type { DashboardSummary } from '../../api/dashboard';

type SubscriptionsListProps = {
  items: DashboardSummary['subscriptions'];
};

export function SubscriptionsList({ items }: SubscriptionsListProps) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Keine wiederkehrenden Zahlungen erkannt.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h3 className="text-sm font-semibold text-slate-800">Abonnements</h3>
      </div>
      <ul className="divide-y divide-slate-100">
        {items.map((item) => (
          <li key={`${item.merchant}-${item.lastDate}`} className="flex items-center justify-between px-5 py-3 text-sm">
            <div>
              <p className="font-medium text-slate-800">{item.merchant}</p>
              <p className="text-xs text-slate-500">
                {item.intervalGuess !== 'unknown' ? item.intervalGuess : 'regelmäßig'}, zuletzt{' '}
                {formatDate(item.lastDate)}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-rose-600">{formatCurrency(item.amount)}</p>
              <p className="text-xs uppercase tracking-wide text-slate-500">{item.category}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}


