import { goals } from '../../data/mock'
import { formatCurrencyEUR } from '../../lib/format'

export default function SavingsGoals() {
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 shadow-soft border dark:border-neutral-800">
      <div className="font-semibold mb-3">Savings Goals</div>
      <div className="grid sm:grid-cols-3 gap-4">
        {goals.map(g => {
          const pct = Math.min(100, Math.round((g.current / g.target) * 100))
          return (
            <div key={g.name} className="p-4 rounded-xl border dark:border-neutral-800">
              <div className="text-sm text-neutral-500 dark:text-neutral-400">{g.name}</div>
              <div className="text-lg font-semibold">{formatCurrencyEUR(g.current)} / {formatCurrencyEUR(g.target)}</div>
              <div className="mt-2 h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div className="h-full bg-nimbus-primary" style={{ width: `${pct}%` }} />
              </div>
              <div className="text-xs mt-1 text-neutral-500 dark:text-neutral-400">{pct}%</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

