export default function TaxTips() {
  const tips = [
    'Check Werbungskosten for commuting.',
    'Use Freistellungsauftrag for investments.',
    'Track recurring subscriptions for VAT where applicable.'
  ]
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 shadow-soft border dark:border-neutral-800">
      <div className="font-semibold mb-2">Tax Tips</div>
      <ul className="list-disc pl-5 space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
        {tips.map((t,i)=><li key={i}>{t}</li>)}
      </ul>
    </div>
  )
}

