import { achievements } from '../../data/mock'
import { Trophy } from 'lucide-react'

export default function Trophies() {
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 shadow-soft border dark:border-neutral-800">
      <div className="font-semibold mb-3 flex items-center gap-2"><Trophy size={18}/> Achievements</div>
      <div className="space-y-2">
        {achievements.map(a => (
          <div key={a.title} className="p-3 rounded-xl border dark:border-neutral-800">
            <div className="font-medium">{a.title}</div>
            <div className="text-sm text-neutral-500 dark:text-neutral-400">{a.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

