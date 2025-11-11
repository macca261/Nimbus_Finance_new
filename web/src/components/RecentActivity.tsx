import Card from './ui/Card';

type Item = { id: string; merchant: string; date: string; amount: number };

export default function RecentActivity({ items }: { items: Item[] }) {
  if (!items || items.length === 0) {
    return (
      <Card>
        <div className="p-4 text-sm font-medium">Recent Activity</div>
        <div className="px-4 pb-4 text-sm text-slate-500 dark:text-slate-400">
          No recent transactions
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-4 text-sm font-medium">Recent Activity</div>
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {items.slice(0, 8).map((tx) => (
          <li key={tx.id} className="flex justify-between items-center px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <div>
              <div className="font-medium">{tx.merchant}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {new Date(tx.date).toLocaleDateString('de-DE')}
              </div>
            </div>
            <div
              className={`font-medium tabular-nums ${
                tx.amount < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {tx.amount < 0 ? '-' : '+'}
              {Math.abs(tx.amount).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

