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
    <aside className="h-screen w-72 shrink-0 border-r bg-white dark:bg-neutral-900 dark:border-neutral-800 flex flex-col">
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="text-xl font-semibold">Nimbus <span className="text-nimbus-primary">Finance</span></div>
      </div>
      <nav className="px-2 space-y-1">
        {nav.map((n) => (
          <a key={n.label} href="#" className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-nimbus-primary">
            <n.icon size={18}/> {n.label}
          </a>
        ))}
      </nav>
      <div className="mt-auto p-4 flex items-center gap-3">
        <img src="https://i.pravatar.cc/48" alt="User avatar" className="w-9 h-9 rounded-full"/>
        <div className="text-sm">
          <div className="font-medium">Aaron</div>
          <div className="text-neutral-500 dark:text-neutral-400">Free plan</div>
        </div>
      </div>
    </aside>
  )
}
