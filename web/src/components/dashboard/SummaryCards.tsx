import { formatCurrency } from '../../lib/format';

type SummaryCardsProps = {
  currentBalance: number;
  income30d: number;
  expenses30d: number;
  net30d: number;
};

const CARD_STYLE =
  'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md';

export function SummaryCards({ currentBalance, income30d, expenses30d, net30d }: SummaryCardsProps) {
  const items = [
    { label: 'Kontostand', value: formatCurrency(currentBalance) },
    { label: 'Einnahmen (30 Tage)', value: formatCurrency(income30d), accent: 'positive' as const },
    { label: 'Ausgaben (30 Tage)', value: formatCurrency(expenses30d), accent: 'negative' as const },
    {
      label: 'Netto (30 Tage)',
      value: formatCurrency(net30d),
      accent: net30d >= 0 ? 'positive' : 'negative',
    } as const,
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className={`${CARD_STYLE} ${
            item.accent === 'positive'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : item.accent === 'negative'
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'text-slate-800'
          }`}
        >
          <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold">{item.value}</p>
        </div>
      ))}
    </div>
  );
}


