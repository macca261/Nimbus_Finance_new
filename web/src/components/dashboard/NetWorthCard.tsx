export default function NetWorthCard({ value = 12500, delta = 2.3 }: { value?: number; delta?: number }) {
  const formatted = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
  const sign = delta >= 0 ? '+' : '';
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-sm text-gray-600">Net Worth</div>
      <div className="text-2xl font-semibold mt-1">{formatted}</div>
      <div className={`text-sm mt-1 ${delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>{sign}{delta.toFixed(1)}% vs last month</div>
    </div>
  );
}


