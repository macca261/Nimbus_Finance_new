import { insights } from '../../data/mock'
import { formatCurrencyEUR } from '../../lib/format'

export default function Behavioral() {
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 shadow-soft border dark:border-neutral-800">
      <div className="font-semibold mb-3">Behavioral Insights</div>
      <div className="space-y-3">
        {insights.map(i => {
          const max = Math.max(i.you, i.peers)
          const youW = Math.round((i.you/max)*100)
          const peerW = Math.round((i.peers/max)*100)
          return (
            <div key={i.label}>
              <div className="flex justify-between text-sm">
                <div>{i.label}</div>
                <div className="text-neutral-500 dark:text-neutral-400">{formatCurrencyEUR(i.you)} vs {formatCurrencyEUR(i.peers)}</div>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <div className="h-2 bg-neutral-200 dark:bg-neutral-800 rounded">
                  <div className="h-2 bg-nimbus-primary rounded" style={{ width: `${youW}%` }}/>
                </div>
                <div className="h-2 bg-neutral-200 dark:bg-neutral-800 rounded">
                  <div className="h-2 bg-emerald-500 rounded" style={{ width: `${peerW}%` }}/>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

