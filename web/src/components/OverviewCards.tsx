type Card = { title: string; value: string; trend?: string; positive?: boolean };

const CardItem = ({ title, value, trend, positive }: Card) => (
  <div className="border rounded-xl p-4 shadow-sm bg-white">
    <p className="text-sm text-gray-500">{title}</p>
    <p className="text-2xl font-semibold mt-1">{value}</p>
    {trend && (
      <p className={`text-sm mt-1 ${positive ? 'text-green-600' : 'text-red-600'}`}>{trend}</p>
    )}
  </div>
);

export default function OverviewCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <CardItem title="Current Balance" value="€2,450.80" trend="+5.2%" positive />
      <CardItem title="Monthly Income" value="€3,250.00" trend="+8.1%" positive />
      <CardItem title="Monthly Expenses" value="€1,245.60" trend="-3.7%" />
      <CardItem title="Net Flow" value="€799.20" trend="+12.4%" positive />
    </div>
  );
}


