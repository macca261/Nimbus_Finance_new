import { Link, useLocation } from 'react-router-dom';
import { colors } from '../../styles/design-system';

const nav = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/upload', label: 'Upload CSV' },
  { to: '/categories', label: 'Categories' },
  { to: '/connections', label: 'Connections' },
  { to: '/reports', label: 'Reports' },
];

export default function Sidebar() {
  const { pathname } = useLocation();
  return (
    <aside aria-label="Primary" style={{ background: colors.gray[50] }} className="hidden md:block w-64 min-h-screen border-r">
      <div className="px-4 py-5">
        <div className="text-xl font-semibold" style={{ color: colors.trustBlue[700] }}>Nimbus Finance</div>
      </div>
      <nav className="px-2">
        <ul className="space-y-1">
          {nav.map(item => {
            const active = pathname.startsWith(item.to);
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md ${active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-700 hover:bg-white'}`}
                >
                  <span className="text-sm">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}


