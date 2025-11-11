import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Card from '../ui/Card';

const COLORS = ['#7c3aed', '#22c55e', '#06b6d4', '#f59e0b', '#ef4444', '#a3e635', '#14b8a6', '#60a5fa'];

type Slice = { name: string; value: number };

export default function SpendDonut({ data }: { data: Slice[] }) {
  return (
    <Card>
      <div className="p-4 text-sm font-medium">Spending by Category</div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} innerRadius={55} outerRadius={80} dataKey="value" nameKey="name">
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => `${value.toFixed(2)} €`}
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
              }}
            />
            <Legend
              formatter={(value) => value}
              wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

