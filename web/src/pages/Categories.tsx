import { useEffect, useState } from 'react';
import { categoriesList, categoriesBreakdown } from '@/lib/api';

function firstDayISO(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10); }
function todayISO(d = new Date()) { return d.toISOString().slice(0,10); }

type Cat = { id: string; name: string };

export default function CategoriesPage() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [data, setData] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const catsRes = await categoriesList();
        setCats(catsRes.items || catsRes.categories || []);
        const bd = await categoriesBreakdown(firstDayISO(), todayISO());
        const map: Record<string, number> = {};
        (bd.items || []).forEach((it: any) => { map[it.categoryId] = it.total; });
        setData(map);
      } catch (e: any) {
        setError(e?.response?.data?.error || 'Failed to load categories');
      }
    })();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Categories</h1>
      {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
      <table className="w-full text-sm bg-white rounded-xl border">
        <thead><tr><th className="p-2 text-left">Category</th><th className="p-2 text-right">MTD Total</th></tr></thead>
        <tbody>
          {cats.map(c => (
            <tr key={c.id} className="border-t">
              <td className="p-2">{c.name}</td>
              <td className={`p-2 text-right ${ (data[c.id]||0) < 0 ? 'text-red-600' : 'text-green-700'}`}>
                {new Intl.NumberFormat('de-DE', { style:'currency', currency:'EUR' }).format(data[c.id] || 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


