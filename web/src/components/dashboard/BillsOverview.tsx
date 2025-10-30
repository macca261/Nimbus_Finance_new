export default function BillsOverview({ items = [] as { name: string; due: string; amount: number }[] }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="font-medium mb-2">Bills & Subscriptions</div>
      {items.length === 0 ? (
        <div className="text-sm text-gray-600">No upcoming renewals.</div>
      ) : (
        <ul className="text-sm">
          {items.map((b, i) => (
            <li key={`${b.name}-${i}`} className="flex items-center justify-between border-t py-2">
              <span>{b.name}</span>
              <span>{b.due} · {new Intl.NumberFormat('de-DE', { style:'currency', currency:'EUR' }).format(b.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


