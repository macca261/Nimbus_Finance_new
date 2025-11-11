import React from 'react';
import {
  LayoutDashboard,
  CreditCard,
  Target,
  Sparkles,
  Wallet,
  LineChart,
  Settings,
  Menu,
  X,
  Power,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from '../ThemeToggle';

type SidebarProps = {
  status: 'loading' | 'online' | 'offline';
  open: boolean;
  onClose: () => void;
};

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/imports', label: 'Daten & Uploads', icon: UploadCloud },
  { to: '/transactions', label: 'Transaktionen', icon: CreditCard },
  { to: '/budgets', label: 'Budgets', icon: Target },
  { to: '/goals', label: 'Goals', icon: Sparkles },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/insights', label: 'Insights', icon: LineChart },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ status, open, onClose }: SidebarProps) {
  const { pathname } = useLocation();

  const statusLabel =
    status === 'online' ? 'online' : status === 'offline' ? 'offline' : 'prüfe…';
  const statusTone =
    status === 'online'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
      : status === 'offline'
      ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200'
      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm transition-opacity md:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-full transform flex-col border-r border-slate-200 bg-white px-5 py-6 shadow-xl transition-transform dark:border-slate-800 dark:bg-slate-950 md:static md:z-auto md:translate-x-0 md:px-6 ${
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200">
              <span className="text-lg font-semibold">N</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Nimbus Finance</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Personal Wealth OS</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 focus:outline-none md:hidden dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
            aria-label="Navigation schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <nav className="mt-10 flex-1 space-y-1">
          {NAV_ITEMS.map(item => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={`group relative flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-indigo-100 text-indigo-700 shadow-sm dark:bg-indigo-500/10 dark:text-indigo-100'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900/60'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <span
                  className={`absolute inset-y-2 left-0 w-1 rounded-full transition ${
                    active ? 'bg-indigo-500' : 'bg-transparent group-hover:bg-indigo-200 dark:group-hover:bg-indigo-400/40'
                  }`}
                />
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <section className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-slate-400" />
              Systemstatus
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] ${statusTone}`}>
              <span className="inline-block h-2 w-2 rounded-full bg-current" />
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <ThemeToggle />
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-transparent px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:border-slate-200 hover:text-slate-800 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:text-slate-100"
            >
              <Power className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </section>

        <footer className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200">
              NU
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">Nimbus Nutzer</p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200">
                Premium
              </span>
            </div>
          </div>
        </footer>
      </aside>
    </>
  );
}

export function SidebarToggleButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-indigo-200 hover:text-indigo-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-indigo-200"
      aria-label="Navigation öffnen"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}

