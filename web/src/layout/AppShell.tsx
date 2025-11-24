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
    <div className="flex min-h-screen bg-nf-bg-root text-nf-text-main transition-colors">
      <Sidebar status={status} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col relative z-10">
        <main className="relative flex-1 overflow-y-auto min-h-screen bg-nf-shell">
          <div className="max-w-[1360px] mx-auto px-8 py-6">
            <div className="mb-4 flex items-center justify-between md:hidden">
              <SidebarToggleButton onClick={() => setSidebarOpen(true)} />
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};


