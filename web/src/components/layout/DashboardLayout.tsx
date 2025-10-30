import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import BottomNavigation from './BottomNavigation';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="md:flex">
        <Sidebar />
        <main className="flex-1 min-w-0">
          <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="font-medium">Übersicht</div>
              <div className="text-sm text-gray-600">Sicherheit auf Bankniveau</div>
            </div>
          </header>
          <div className="max-w-6xl mx-auto px-4 py-6">
            {children}
          </div>
        </main>
      </div>
      <BottomNavigation />
    </div>
  );
}


