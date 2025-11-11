import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Card from '../ui/Card';

type Point = { month: string; income: number; expense: number };

export default function CashflowLine({ data }: { data: Point[] }) {
  return (
    <Card>
      <div className="p-4 text-sm font-medium">Cash flow</div>
      <div className="h-64 px-2 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
            <XAxis
              dataKey="month"
              stroke="#94a3b8"
              className="dark:stroke-slate-400"
              tick={{ fill: 'currentColor' }}
            />
            <YAxis
              stroke="#94a3b8"
              className="dark:stroke-slate-400"
              tick={{ fill: 'currentColor' }}
              tickFormatter={(value) => `${value}€`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
              }}
            />
            <Line
              type="monotone"
              dataKey="expense"
              stroke="#f59e0b"
              dot={false}
              strokeWidth={2}
              name="Expense"
            />
            <Line
              type="monotone"
              dataKey="income"
              stroke="#6366f1"
              dot={false}
              strokeWidth={2}
              name="Income"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

