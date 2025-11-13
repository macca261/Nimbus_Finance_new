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
  SlidersHorizontal,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from '../ThemeToggle';
import { classnames } from '../../ui/tokens';

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
      ? 'border-emerald-300/70 text-emerald-700 dark:border-emerald-600/60 dark:text-emerald-300'
      : status === 'offline'
      ? 'border-rose-300/70 text-rose-700 dark:border-rose-600/60 dark:text-rose-300'
      : 'border-slate-300/70 text-slate-600 dark:border-slate-600/60 dark:text-slate-300';

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
        className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-full transform flex-col border-r border-slate-200/70 bg-white/70 px-5 py-5 shadow-lg shadow-slate-900/5 backdrop-blur-md transition-transform dark:border-slate-800/70 dark:bg-slate-900/60 md:static md:z-auto md:w-60 md:translate-x-0 md:px-5 ${
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200">
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
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 md:hidden dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900 ${classnames.focusRing}`}
            aria-label="Navigation schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <nav className="mt-8 flex-1 space-y-1.5">
          {NAV_ITEMS.map(item => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={`group relative flex items-center gap-3 rounded-xl border px-3.5 py-2 text-sm font-medium transition ${classnames.focusRing} ${
                  active
                    ? 'border-indigo-300/80 bg-white text-indigo-700 dark:border-indigo-500/40 dark:bg-slate-900/80 dark:text-indigo-100'
                    : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-100/70 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900/60'
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

          <div className="mt-6 space-y-1.5">
            <p className="px-3.5 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Admin
            </p>
            <Link
              to="/admin/normalizer"
              onClick={onClose}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2 text-sm transition ${classnames.focusRing} ${
                pathname === '/admin/normalizer'
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-slate-900/80 dark:text-indigo-200'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900/60'
              }`}
              aria-current={pathname === '/admin/normalizer' ? 'page' : undefined}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Normalizer</span>
            </Link>
          </div>
        </nav>

        <section className="mt-4 space-y-4 rounded-xl border border-slate-200/70 bg-white/60 p-4 dark:border-slate-800/70 dark:bg-slate-900/60">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-slate-400" />
              Systemstatus
            </span>
            <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] ${statusTone}`}>
              <span className="inline-block h-2 w-2 rounded-full bg-current" />
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <ThemeToggle />
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:border-slate-200 hover:text-slate-800 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:text-slate-100 ${classnames.focusRing}`}
            >
              <Power className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </section>

        <footer className="mt-5 rounded-xl border border-slate-200/70 bg-white/70 px-4 py-4 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200">
              NU
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">Nimbus Nutzer</p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-md border border-indigo-200/70 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:border-indigo-500/40 dark:text-indigo-200">
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
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-indigo-200 ${classnames.focusRing}`}
      aria-label="Navigation öffnen"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}

