import { Link, useLocation } from 'react-router-dom';

const items = [
  { to: '/dashboard', label: 'Home' },
  { to: '/upload', label: 'Upload' },
  { to: '/categories', label: 'Kategorien' },
  { to: '/connections', label: 'Konten' },
];

export default function BottomNavigation() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed md:hidden bottom-0 left-0 right-0 border-t bg-white">
      <ul className="grid grid-cols-4">
        {items.map(it => {
          const active = pathname.startsWith(it.to);
          return (
            <li key={it.to} className={`text-center py-2 ${active ? 'text-blue-600' : 'text-gray-700'}`}>
              <Link to={it.to} className="text-sm" aria-current={active ? 'page' : undefined}>{it.label}</Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}


