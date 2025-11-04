import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#6D28D9','#0EA5E9','#22C55E','#FBBF24','#EF4444','#94A3B8'];

export function Donut({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((a,b)=>a+b.value,0) || 1;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={70} outerRadius={100}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(v:number) => `${(v/100).toFixed(2)} €`} />
      </PieChart>
    </ResponsiveContainer>
  );
}

