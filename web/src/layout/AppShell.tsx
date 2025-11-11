import React, { useEffect, useState } from 'react';
import Sidebar, { SidebarToggleButton } from '../components/layout/Sidebar';

type ServiceStatus = 'loading' | 'online' | 'offline';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [status, setStatus] = useState<ServiceStatus>('loading');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health', { method: 'GET' });
        if (!cancelled) {
          setStatus(res.ok ? 'online' : 'offline');
        }
      } catch {
        if (!cancelled) {
          setStatus('offline');
        }
      }
    };

    void checkHealth();
    const interval = window.setInterval(checkHealth, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-50">
      <Sidebar status={status} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col">
        <main className="relative flex-1 overflow-y-auto px-4 py-6 sm:px-8 lg:px-10 xl:px-12">
          <div className="mb-4 flex items-center justify-between md:hidden">
            <SidebarToggleButton onClick={() => setSidebarOpen(true)} />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
};


