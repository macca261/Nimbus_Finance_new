import React, { useEffect, useState } from 'react';
import Sidebar, { SidebarToggleButton } from '../components/layout/Sidebar';

type ApiStatus = 'loading' | 'ok' | 'offline';

export interface AppLayoutProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export default function AppLayout({ title, description, actions, children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiStatus>('loading');

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch('/api/health', { method: 'GET' });
        if (!cancelled) {
          setApiStatus(res.ok ? 'ok' : 'offline');
        }
      } catch {
        if (!cancelled) {
          setApiStatus('offline');
        }
      }
    };
    void check();
    const interval = window.setInterval(check, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const showHeader = Boolean(title || description || actions);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} apiStatus={apiStatus} />
      <div className="flex min-h-screen flex-col md:pl-72">
        {showHeader && (
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-sm transition-colors dark:border-slate-800 dark:bg-slate-950/90">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-8">
              <div className="flex items-center gap-3">
                <SidebarToggleButton onClick={() => setSidebarOpen(true)} />
                <div>
                  {title ? (
                    <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
                  ) : null}
                  {description ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
                  ) : null}
                </div>
              </div>
              {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
            </div>
          </header>
        )}
        <main className="flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 lg:py-10">
            {!showHeader ? (
              <div className="mb-4 md:hidden">
                <SidebarToggleButton onClick={() => setSidebarOpen(true)} />
              </div>
            ) : null}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}


