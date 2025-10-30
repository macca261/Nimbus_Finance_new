export default function FinancialHealthScore({ score = 72 }: { score?: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const dash = (clamped / 100) * circumference;
  const color = clamped >= 80 ? '#22c55e' : clamped >= 60 ? '#0ea5e9' : '#f59e0b';
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-sm text-gray-600 mb-2">Financial Health</div>
      <div className="flex items-center gap-4">
        <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={`Financial health ${clamped}%`}>
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10" />
          <circle
            cx="60" cy="60" r={radius}
            fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            transform="rotate(-90 60 60)"
          />
          <text x="60" y="65" textAnchor="middle" fontSize="20" fill="#0f172a" fontWeight="600">{clamped}%</text>
        </svg>
        <div className="text-sm text-gray-700">
          <div className="font-medium">Your financial wellness is {clamped}%</div>
          <div className="text-gray-500">Improve by reducing subscriptions and setting a monthly budget.</div>
        </div>
      </div>
    </div>
  );
}


