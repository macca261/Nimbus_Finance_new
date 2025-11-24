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
  AlertCircle,
  Trophy,
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
  { to: '/review', label: 'Überprüfung', icon: AlertCircle },
  { to: '/budgets', label: 'Budgets', icon: Target },
  { to: '/goals', label: 'Goals', icon: Sparkles },
  { to: '/wallet', label: 'Wallet', icon: Wallet },
  { to: '/insights', label: 'Insights', icon: LineChart },
  { to: '/achievements', label: 'Erfolge', icon: Trophy },
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
        className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-full transform flex-col border-r border-nf-border-subtle bg-nf-bg-sidebar px-5 py-5 shadow-xl transition-transform md:static md:z-auto md:w-64 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-nf-primary/20 text-nf-primary">
              <span className="text-lg font-semibold">N</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Nimbus Finance</p>
              <p className="text-xs text-slate-400">Personal Wealth OS</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-nf-border-subtle text-slate-400 transition hover:bg-nf-bg-card md:hidden ${classnames.focusRing}`}
            aria-label="Navigation schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <nav className="flex-1 space-y-1.5">
          {NAV_ITEMS.map(item => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${classnames.focusRing} ${
                  active
                    ? 'bg-nf-primary text-white shadow-lg shadow-nf-primary/20'
                    : 'text-slate-300 hover:bg-nf-bg-card hover:text-white'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="mt-6 space-y-1.5">
            <p className="px-3 text-xs font-medium uppercase tracking-wide text-slate-500">
              Settings
            </p>
            <Link
              to="/settings/normalizer"
              onClick={onClose}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${classnames.focusRing} ${
                pathname === '/settings/normalizer'
                  ? 'bg-nf-primary text-white'
                  : 'text-slate-300 hover:bg-nf-bg-card hover:text-white'
              }`}
              aria-current={pathname === '/settings/normalizer' ? 'page' : undefined}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Normalizer</span>
            </Link>
          </div>

          <div className="mt-6 space-y-1.5">
            <p className="px-3 text-xs font-medium uppercase tracking-wide text-slate-500">
              Admin
            </p>
            <Link
              to="/admin/imports"
              onClick={onClose}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${classnames.focusRing} ${
                pathname === '/admin/imports'
                  ? 'bg-nf-primary text-white'
                  : 'text-slate-300 hover:bg-nf-bg-card hover:text-white'
              }`}
              aria-current={pathname === '/admin/imports' ? 'page' : undefined}
            >
              <UploadCloud className="h-4 w-4" />
              <span>Imports</span>
            </Link>
          </div>
        </nav>

        {/* Upgrade to Pro Card */}
        <div className="mt-auto mb-6 rounded-2xl border border-nf-primary/20 bg-gradient-to-br from-nf-primary/10 to-nf-primary/5 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-nf-primary/20 text-nf-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white mb-1">Upgrade to Pro</p>
              <p className="text-xs text-slate-300 leading-relaxed">
                Erweiterte Analysen, unbegrenzte Konten und mehr.
              </p>
              <button
                type="button"
                className="mt-3 w-full rounded-lg bg-nf-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-nf-primary/90"
              >
                Jetzt upgraden
              </button>
            </div>
          </div>
        </div>

        {/* Status & User Footer */}
        <div className="space-y-3 border-t border-nf-border-subtle pt-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              Systemstatus
            </span>
            <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] ${
              status === 'online'
                ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                : status === 'offline'
                ? 'border-rose-500/30 text-rose-400 bg-rose-500/10'
                : 'border-slate-500/30 text-slate-400 bg-slate-500/10'
            }`}>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <ThemeToggle />
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition hover:text-white ${classnames.focusRing}`}
            >
              <Power className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-nf-border-subtle">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-nf-primary/20 text-nf-primary text-xs font-semibold">
              NU
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">Nimbus Nutzer</p>
              <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-nf-primary bg-nf-primary/10">
                Premium
              </span>
            </div>
          </div>
        </div>
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

