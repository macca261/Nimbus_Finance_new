import { Link } from 'react-router-dom';

export default function QuickActions() {
  const items = [
    { to: '/upload', label: 'Import CSV' },
    { to: '/connections', label: 'Connect Bank' },
    { to: '/dashboard', label: 'Create Budget' },
    { to: '/dashboard', label: 'Add Manual' },
  ];
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="font-medium mb-2">Quick Actions</div>
      <div className="grid grid-cols-2 gap-2">
        {items.map(it => (
          <Link key={it.label} to={it.to} className="px-3 py-2 rounded-md border hover:bg-gray-50 text-sm text-center">
            {it.label}
          </Link>
        ))}
      </div>
    </div>
  );
}


