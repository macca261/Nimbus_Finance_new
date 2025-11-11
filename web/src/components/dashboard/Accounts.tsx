import { accounts } from '../../data/mock'
import { formatCurrencyEUR } from '../../lib/format'

export default function Accounts() {
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 shadow-soft border dark:border-neutral-800">
      <div className="font-semibold mb-3">Connected Accounts</div>
      <div className="space-y-2">
        {accounts.map(a => (
          <div key={a.bank+a.last4} className="flex items-center justify-between p-3 rounded-xl border dark:border-neutral-800">
            <div className="text-sm">{a.bank} • {a.type} • •••• {a.last4}</div>
            <div className={`text-sm font-medium ${a.balance < 0 ? 'text-rose-600' : ''}`}>{formatCurrencyEUR(a.balance)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

