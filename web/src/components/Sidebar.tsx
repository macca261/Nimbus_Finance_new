import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CreditCard, PiggyBank, BarChart3, Target, Trophy, Settings } from 'lucide-react';

const linkBase = 'flex items-center gap-3 px-4 py-2 rounded-md transition';

export default function Sidebar() {
  const item = (to: string, label: string, Icon: any) => (
    <NavLink
      to={to}
      className={({ isActive }) => `${linkBase} ${isActive ? 'bg-primary-300/20 text-primary-500' : 'text-gray-700 hover:bg-gray-100'}`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </NavLink>
  );

  return (
    <aside className="w-64 border-r min-h-screen p-4 hidden md:block">
      <div className="text-xl font-semibold text-primary-500 mb-6">Nimbus Finance</div>
      <nav className="space-y-1">
        {item('/dashboard', 'Dashboard', LayoutDashboard)}
        {item('/transactions', 'Transactions', CreditCard)}
        {item('/budget', 'Budget', PiggyBank)}
        {item('/reports', 'Reports', BarChart3)}
        {item('/goals', 'Goals', Target)}
        {item('/achievements', 'Achievements', Trophy)}
        {item('/settings', 'Settings', Settings)}
      </nav>
    </aside>
  );
}


