import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

export default function CreditScore() {
  const score = 741
  const pct = Math.min(100, Math.max(0, Math.round((score-300)/(850-300)*100)))
  const data = [{ name: 'score', value: pct }, { name: 'remain', value: 100-pct }]
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 shadow-soft border dark:border-neutral-800">
      <div className="font-semibold mb-2">Credit Score</div>
      <div className="h-40 relative">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} innerRadius={55} outerRadius={80} dataKey="value" startAngle={90} endAngle={-270}>
              <Cell fill="#10b981" />
              <Cell fill="#e5e7eb" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-semibold">{score}</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">{pct}%</div>
          </div>
        </div>
      </div>
    </div>
  )
}

