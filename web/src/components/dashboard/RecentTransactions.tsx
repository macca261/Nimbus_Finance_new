type Tx = { id: string; bookingDate: string; purpose?: string; amount: number; currency?: string };

export default function RecentTransactions({ rows = [] as Tx[] }: { rows?: Tx[] }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="font-medium mb-2">Recent Transactions</div>
      <table className="w-full text-sm">
        <thead><tr className="text-gray-600"><th className="text-left p-2">Datum</th><th className="text-left p-2">Verwendungszweck</th><th className="text-right p-2">Betrag</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{r.bookingDate}</td>
              <td className="p-2 truncate max-w-[480px]">{r.purpose || ''}</td>
              <td className={`p-2 text-right ${r.amount < 0 ? 'text-red-600' : 'text-green-700'}`}>
                {Number(r.amount).toLocaleString('de-DE', { style: 'currency', currency: r.currency || 'EUR' })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


