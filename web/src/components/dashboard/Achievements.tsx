import type { DashboardSummary } from '../../api/dashboard';

type AchievementsProps = {
  items: DashboardSummary['achievements'];
};

export function Achievements({ items }: AchievementsProps) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
        Noch keine Erfolge verfügbar.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-800">Erfolge</h3>
      <ul className="mt-3 space-y-3 text-sm">
        {items.map(item => {
          const variant = item.achieved
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-slate-200 bg-slate-50 text-slate-600';
          return (
            <li key={item.id} className={`rounded-xl border p-4 transition ${variant}`}>
              <p className="font-semibold">{item.title}</p>
              <p className="mt-1 text-xs text-slate-500">{item.description}</p>
              <p className="mt-2 text-xs uppercase tracking-wide">
                {item.achieved ? 'Freigeschaltet' : 'Noch nicht erreicht'}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}


