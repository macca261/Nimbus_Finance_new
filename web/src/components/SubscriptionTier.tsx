export default function SubscriptionTier({ currentTier }: { currentTier: string }) {
  const tiers = [
    { name: 'Free', price: '€0', features: ['Unlimited CSV uploads', 'Basic categorization', '30-day history', 'Local processing only'] },
    { name: 'Pro Lite', price: '€3.99', features: ['1 bank connection', 'AI categorization', '12-month history', 'Auto-sync transactions', 'Advanced insights'] },
    { name: 'Pro Plus', price: '€7.99', features: ['3 bank connections', 'AI + forecasting', 'Unlimited history', 'Tax optimization', 'DATEV exports', 'Priority support'] },
  ];
  const toKey = (s: string) => s.toLowerCase().replace(' ', '_');
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {tiers.map(t => {
        const key = toKey(t.name);
        const highlighted = key === currentTier;
        return (
          <div key={t.name} className={`border rounded-lg p-6 ${highlighted ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
            <h3 className="text-lg font-semibold mb-2">{t.name}</h3>
            <div className="text-2xl font-bold mb-4">{t.price}<span className="text-sm font-normal">/month</span></div>
            <ul className="space-y-2 mb-6">
              {t.features.map((f, idx) => (
                <li key={idx} className="flex items-center"><span className="text-green-500 mr-2">✓</span><span className="text-sm">{f}</span></li>
              ))}
            </ul>
            <button className={`w-full py-2 rounded ${highlighted ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}>
              {highlighted ? 'Current Plan' : 'Upgrade'}
            </button>
          </div>
        );
      })}
    </div>
  );
}


