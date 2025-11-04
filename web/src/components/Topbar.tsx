import ThemeToggle from './ThemeToggle';

export default function Topbar({ onToggleAI }: { onToggleAI?: () => void }) {
  return (
    <div className="border-b px-4 py-3 flex items-center justify-between">
      <div className="text-lg font-semibold">Hello, Aaron!</div>
      <div className="flex items-center gap-3">
        <div className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm">Health Score: 72</div>
        <button className="btn btn-primary">+ Add Goal</button>
        <button className="btn">Import CSV</button>
        <ThemeToggle />
      </div>
    </div>
  );
}


