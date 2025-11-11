import { subscriptions } from '../../data/mock'
import { formatCurrencyEUR, formatDateDE } from '../../lib/format'

export default function Subscriptions() {
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 shadow-soft border dark:border-neutral-800">
      <div className="font-semibold mb-3">Upcoming Subscriptions</div>
      <div className="space-y-2">
        {subscriptions.map(s=>(
          <div key={s.name} className="flex items-center justify-between p-3 rounded-xl border dark:border-neutral-800">
            <div className="text-sm">{s.name}</div>
            <div className="text-sm text-neutral-500 dark:text-neutral-400">{formatDateDE(s.next)}</div>
            <div className="text-sm font-medium">{formatCurrencyEUR(s.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
