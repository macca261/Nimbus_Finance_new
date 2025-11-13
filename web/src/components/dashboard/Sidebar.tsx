import { Home, Wallet, PieChart, Target, Banknote, LineChart, Receipt, Settings } from 'lucide-react'

const nav = [
  { icon: Home, label: 'Overview' },
  { icon: Wallet, label: 'Transactions' },
  { icon: PieChart, label: 'Budgets' },
  { icon: Target, label: 'Goals' },
  { icon: Banknote, label: 'Accounts' },
  { icon: LineChart, label: 'Investments' },
  { icon: Receipt, label: 'Bills' },
  { icon: Settings, label: 'Settings' }
]

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col rounded-r-xl border-r border-slate-200/70 bg-white/80 px-5 py-5 shadow-md shadow-slate-500/10 backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/70 lg:w-60">
      <div className="flex items-center justify-between">
        <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Nimbus <span className="text-indigo-500">Finance</span>
        </div>
      </div>
      <nav className="mt-8 space-y-1.5">
        {nav.map(n => (
          <a
            key={n.label}
            href="#"
            className="flex items-center gap-3 rounded-xl px-3.5 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
          >
            <n.icon size={18} aria-hidden="true" /> {n.label}
          </a>
        ))}
      </nav>
      <div className="mt-auto flex items-center gap-3 rounded-xl border border-slate-200/70 px-3.5 py-3 text-sm text-slate-600 dark:border-slate-800/60 dark:text-slate-300">
        <img src="https://i.pravatar.cc/48" alt="User avatar" className="h-9 w-9 rounded-full" />
        <div>
          <div className="font-medium text-slate-900 dark:text-slate-100">Aaron</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Free plan</div>
        </div>
      </div>
    </aside>
  );
}
