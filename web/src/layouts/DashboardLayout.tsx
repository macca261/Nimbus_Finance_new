import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import AskAIDrawer from '../components/AskAIDrawer';

const navItems = [
  { path: '/', label: 'Overview', icon: '📊' },
  { path: '/transactions', label: 'Transactions', icon: '💳' },
  { path: '/budgets', label: 'Budgets', icon: '💰' },
  { path: '/import', label: 'Imports', icon: '📥' },
  { path: '/goals', label: 'Goals', icon: '🎯' },
  { path: '/insights', label: 'Insights (AI)', icon: '🤖' },
];

export default function DashboardLayout() {
  const location = useLocation();
  const [showAIDrawer, setShowAIDrawer] = useState(false);

  return (
    <div className="flex h-screen bg-secondary">
      {/* Left Rail */}
      <aside className="w-64 bg-surface border-r border-default flex flex-col">
        <div className="p-4 border-b border-default">
          <h1 className="text-xl font-bold text-primary">Nimbus Finance</h1>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-muted hover:bg-surface-hover hover:text-primary'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-default">
          <ThemeToggle />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 bg-surface border-b border-default flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted">API Status:</span>
            <span className="text-sm font-medium text-green-600 dark:text-green-400">● Online</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAIDrawer(true)}
              className="px-4 py-2 rounded-md bg-primary text-white hover:bg-primary-hover transition-colors"
            >
              Ask AI
            </button>
            <ThemeToggle />
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>

      {/* AI Drawer */}
      <AskAIDrawer isOpen={showAIDrawer} onClose={() => setShowAIDrawer(false)} />
    </div>
  );
}

