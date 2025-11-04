import { useEffect, useState } from 'react';

type ToastKind = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  message: string;
  kind: ToastKind;
  duration: number;
};

const emitter = new EventTarget();
let idCounter = 0;

export function toast(message: string, kind: ToastKind = 'info', duration = 4500) {
  const detail: ToastItem = {
    id: ++idCounter,
    message,
    kind,
    duration,
  };
  emitter.dispatchEvent(new CustomEvent<ToastItem>('toast:add', { detail }));
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (event: Event) => {
      const toastEvent = event as CustomEvent<ToastItem>;
      const detail = toastEvent.detail;
      setItems(prev => [...prev, detail]);
      if (detail.duration > 0) {
        window.setTimeout(() => {
          setItems(prev => prev.filter(item => item.id !== detail.id));
        }, detail.duration);
      }
    };
    emitter.addEventListener('toast:add', handler);
    return () => {
      emitter.removeEventListener('toast:add', handler);
    };
  }, []);

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
      {items.map(item => (
        <div
          key={item.id}
          className={`min-w-[240px] max-w-sm rounded-xl px-4 py-3 text-sm shadow-lg text-white transition-all ${item.kind === 'success' ? 'bg-emerald-600' : item.kind === 'error' ? 'bg-rose-600' : 'bg-slate-800'}`}
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}


