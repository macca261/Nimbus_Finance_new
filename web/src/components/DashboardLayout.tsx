import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

type Props = { children: ReactNode };

export default function DashboardLayout({ children }: Props) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <Topbar />
        <main className="p-4">{children}</main>
      </div>
    </div>
  );
}


