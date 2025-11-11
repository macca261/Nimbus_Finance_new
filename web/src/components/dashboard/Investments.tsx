import { investments } from '../../data/mock'
import { formatCurrencyEUR } from '../../lib/format'

export default function Investments() {
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 shadow-soft border dark:border-neutral-800">
      <div className="font-semibold mb-3">Investments</div>
      <div className="grid sm:grid-cols-2 gap-3">
        {investments.map(i => (
          <div key={i.name} className="p-4 rounded-xl border dark:border-neutral-800">
            <div className="text-sm text-neutral-500 dark:text-neutral-400">{i.name}</div>
            <div className="text-lg font-semibold">{formatCurrencyEUR(i.value)}</div>
            <div className={`text-sm ${i.changePct>=0?'text-emerald-600':'text-rose-600'}`}>
              {i.changePct>=0?'▲':'▼'} {i.changePct.toFixed(2)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

