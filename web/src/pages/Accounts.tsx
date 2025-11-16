import React, { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../layout/AppShell';
import { toast } from '../lib/toast';

type AccountRole = 'spending' | 'savings' | 'wallet' | 'other';

type ApiAccount = {
  id: string;
  iban?: string | null;
  name?: string | null;
  role?: AccountRole;
  createdAt?: string;
};

const ROLE_OPTIONS: Array<{ value: AccountRole; label: string }> = [
  { value: 'spending', label: 'Girokonto / Alltag' },
  { value: 'savings', label: 'Sparkonto' },
  { value: 'wallet', label: 'Wallet / PayPal' },
  { value: 'other', label: 'Sonstiges' },
];

export const AccountsPage: React.FC = () => {
  const [items, setItems] = useState<ApiAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/accounts');
        if (!res.ok) throw new Error('Konten konnten nicht geladen werden.');
        const json = await res.json();
        const data = Array.isArray(json?.data) ? (json.data as ApiAccount[]) : [];
        if (!cancelled) setItems(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Konten konnten nicht geladen werden.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const onAddAccount = async () => {
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Neues Konto', iban: '', role: 'spending' }),
      });
      if (!res.ok) throw new Error('Konto konnte nicht erstellt werden.');
      const json = await res.json();
      const acc = json?.account as ApiAccount;
      setItems(prev => [acc, ...prev]);
      toast('Konto hinzugefügt', 'success');
    } catch (e: any) {
      toast(e?.message || 'Konto konnte nicht erstellt werden.', 'error');
    }
  };

  const onRoleChange = async (acc: ApiAccount, next: AccountRole) => {
    const prev = acc.role ?? 'spending';
    setItems(list => list.map(a => (a.id === acc.id ? { ...a, role: next } : a)));
    try {
      const res = await fetch(`/api/accounts/${encodeURIComponent(acc.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: next }),
      });
      if (!res.ok) throw new Error('Rolle konnte nicht gespeichert werden.');
      toast('Rolle gespeichert', 'success');
    } catch (e: any) {
      setItems(list => list.map(a => (a.id === acc.id ? { ...a, role: prev } : a)));
      toast(e?.message || 'Rolle konnte nicht gespeichert werden.', 'error');
    }
  };

  const startEditName = (acc: ApiAccount) => {
    setEditingNameId(acc.id);
    setDraftName(acc.name ?? '');
  };
  const cancelEditName = () => {
    setEditingNameId(null);
    setDraftName('');
  };
  const commitEditName = async (acc: ApiAccount) => {
    const next = (draftName || '').trim().slice(0, 80);
    if (!next) {
      toast('Name darf nicht leer sein.', 'error');
      return;
    }
    const prev = acc.name ?? '';
    setItems(list => list.map(a => (a.id === acc.id ? { ...a, name: next } : a)));
    setEditingNameId(null);
    try {
      const res = await fetch(`/api/accounts/${encodeURIComponent(acc.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: next }),
      });
      if (!res.ok) throw new Error('Name konnte nicht gespeichert werden.');
      toast('Name gespeichert', 'success');
    } catch (e: any) {
      setItems(list => list.map(a => (a.id === acc.id ? { ...a, name: prev } : a)));
      toast(e?.message || 'Name konnte nicht gespeichert werden.', 'error');
    }
  };

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm text-slate-500 dark:text-slate-400">Lade Konten…</div>
        </div>
      );
    }
    if (error) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm text-rose-600 dark:text-rose-400">{error}</div>
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-600 dark:text-slate-300">Noch keine Konten angelegt.</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Füge ein Konto hinzu oder importiere Buchungen, damit Nimbus Konten erkennen kann.
              </div>
            </div>
            <button
              type="button"
              onClick={onAddAccount}
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus:ring-indigo-500/40"
            >
              Konto hinzufügen
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-0 shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
            <tr className="text-left">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">IBAN</th>
              <th className="px-4 py-3">Rolle</th>
              <th className="px-4 py-3">Erstellt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {items.map(acc => (
              <tr key={acc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-4 py-3">
                  {editingNameId === acc.id ? (
                    <input
                      autoFocus
                      value={draftName}
                      onChange={e => setDraftName(e.target.value)}
                      onBlur={() => commitEditName(acc)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void commitEditName(acc);
                        } else if (e.key === 'Escape') {
                          cancelEditName();
                        }
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/30"
                      maxLength={80}
                    />
                  ) : (
                    <button
                      type="button"
                      className="text-left text-slate-800 hover:underline dark:text-slate-100"
                      onClick={() => startEditName(acc)}
                      title="Name bearbeiten"
                    >
                      {acc.name || <span className="text-slate-400">Unbenannt</span>}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-slate-600 dark:text-slate-300">{acc.iban || '—'}</span>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={acc.role ?? 'spending'}
                    onChange={e => onRoleChange(acc, e.target.value as AccountRole)}
                    className="rounded-xl border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/30"
                  >
                    {ROLE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {acc.createdAt ? new Date(acc.createdAt).toLocaleDateString('de-DE') : '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, [items, loading, error, editingNameId, draftName]);

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Accounts</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Verwalte Namen und Rollen deiner Konten. Rollen helfen bei der Erkennung interner Überträge.
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={onAddAccount}
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus:ring-indigo-500/40"
            >
              Konto hinzufügen
            </button>
          </div>
        </header>
        {content}
      </div>
    </AppShell>
  );
};

export default AccountsPage;


