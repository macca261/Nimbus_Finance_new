export default function Health() {
  const items = [
    { k: 'Savings Rate', v: '22%' },
    { k: 'Emergency Months', v: '3.2' },
    { k: 'Debt Ratio', v: '8%' },
    { k: 'Credit Utilization', v: '12%' }
  ]
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 shadow-soft border dark:border-neutral-800">
      <div className="font-semibold mb-3">Financial Health</div>
      <div className="grid sm:grid-cols-2 gap-3">
        {items.map(x=>(
          <div key={x.k} className="p-3 rounded-xl border dark:border-neutral-800">
            <div className="text-sm text-neutral-500 dark:text-neutral-400">{x.k}</div>
            <div className="text-lg font-semibold">{x.v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

