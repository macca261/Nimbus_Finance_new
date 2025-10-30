type Item = { categoryId: string; total: number };

export default function SpendingByCategory({ items = [] as Item[] }: { items?: Item[] }) {
  const total = items.reduce((a, b) => a + Math.max(0, b.total), 0) + items.reduce((a, b) => a + Math.max(0, -b.total), 0);
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="font-medium mb-2">Spending by Category</div>
      <ul className="space-y-2">
        {items.map((it) => {
          const pct = total ? Math.round((Math.abs(it.total) / total) * 100) : 0;
          return (
            <li key={it.categoryId} className="text-sm">
              <div className="flex items-center justify-between">
                <span>{it.categoryId}</span>
                <span>{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(it.total)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded overflow-hidden mt-1" aria-hidden>
                <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}


