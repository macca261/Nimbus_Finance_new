import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('nimbus.theme');
    return stored === 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('nimbus.theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    // ensure light is default on first load
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('nimbus.theme');
    if (!stored) {
      localStorage.setItem('nimbus.theme', 'light');
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    }
  }, []);

  return (
    <button
      type="button"
      onClick={() => setIsDark(v => !v)}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
      aria-label={`Wechsle zu ${isDark ? 'Light' : 'Dark'} Mode`}
    >
      {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      <span>{isDark ? 'Dark' : 'Light'}</span>
    </button>
  );
}
