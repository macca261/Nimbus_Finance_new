import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export function MonthBars({ data }: { data: { month: string; incomeCents: number; expenseCents: number }[] }) {
  const display = data.map(d => ({
    month: d.month.slice(5),
    Income: +(d.incomeCents/100).toFixed(2),
    Expenses: +(d.expenseCents/100).toFixed(2),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={display}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="Income" fill="#16A34A" radius={[6,6,0,0]} />
        <Bar dataKey="Expenses" fill="#8B5CF6" radius={[6,6,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

