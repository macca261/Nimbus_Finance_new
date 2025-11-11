import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

export default function Topbar() {
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const [apiStatus, setApiStatus] = useState<'ok' | 'offline'>('ok');

  useEffect(() => {
    // Check API status
    fetch('/api/summary/balance')
      .then((res) => {
        setApiStatus(res.ok ? 'ok' : 'offline');
      })
      .catch(() => {
        setApiStatus('offline');
      });
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">API:</span>
            <span
              className={`text-xs rounded-full px-2 py-0.5 ${
                apiStatus === 'ok'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200'
              }`}
            >
              {apiStatus === 'ok' ? 'ok' : 'offline'}
            </span>
          </div>
          <div className="hidden md:flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                aria-label="Search transactions"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            onClick={() => setDark((v) => !v)}
            aria-label="Toggle dark mode"
          >
            {dark ? '🌙 Dark' : '🌞 Light'}
          </button>
          <button className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden md:block">
            Bank verbinden
          </button>
          <button className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden md:block">
            Fragen an KI
          </button>
        </div>
      </div>
    </header>
  );
}

