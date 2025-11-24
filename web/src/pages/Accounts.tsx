import React, { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../layout/AppShell';
import { toast } from '../lib/toast';
import { fetchAccounts, createAccount, updateAccount, deleteAccount, type Account, type AccountType } from '../api/accountsApi';
import { Plus, Trash2, Edit2, X, Check } from 'lucide-react';

const TYPE_OPTIONS: Array<{ value: AccountType; label: string }> = [
  { value: 'CHECKING', label: 'Girokonto' },
  { value: 'SAVINGS', label: 'Sparkonto' },
  { value: 'CREDIT_CARD', label: 'Kreditkarte' },
  { value: 'CASH', label: 'Bargeld / Wallet' },
  { value: 'OTHER', label: 'Sonstiges' },
];

export const AccountsPage: React.FC = () => {
  const [items, setItems] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'CHECKING' as AccountType,
    iban: '',
    accountNumber: '',
    isPrimary: false,
  });

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const accounts = await fetchAccounts({ includeArchived: false });
      setItems(accounts);
    } catch (e: any) {
      setError(e?.message || 'Konten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAccounts();
  }, []);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const account = await createAccount({
        name: formData.name.trim(),
        type: formData.type,
        iban: formData.iban.trim() || null,
        accountNumber: formData.accountNumber.trim() || null,
        isPrimary: formData.isPrimary,
      });
      setItems(prev => [account, ...prev]);
      setShowAddForm(false);
      setFormData({ name: '', type: 'CHECKING', iban: '', accountNumber: '', isPrimary: false });
      toast('Konto hinzugefügt', 'success');
      void loadAccounts(); // Refresh to get updated order
    } catch (e: any) {
      toast(e?.message || 'Konto konnte nicht erstellt werden.', 'error');
    }
  };

  const handleUpdateAccount = async (accountId: string, updates: Partial<Account>) => {
    try {
      const updated = await updateAccount(accountId, updates);
      setItems(prev => prev.map(a => a.id === accountId ? updated : a));
      setEditingId(null);
      toast('Konto aktualisiert', 'success');
    } catch (e: any) {
      toast(e?.message || 'Konto konnte nicht aktualisiert werden.', 'error');
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm('Möchtest du dieses Konto wirklich löschen? Transaktionen bleiben erhalten.')) {
      return;
    }
    
    setDeletingId(accountId);
    try {
      await deleteAccount(accountId);
      setItems(prev => prev.filter(a => a.id !== accountId));
      toast('Konto gelöscht', 'success');
    } catch (e: any) {
      toast(e?.message || 'Konto konnte nicht gelöscht werden.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (account: Account) => {
    setEditingId(account.id);
    setFormData({
      name: account.name,
      type: account.type,
      iban: account.iban || '',
      accountNumber: account.accountNumber || '',
      isPrimary: account.isPrimary,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ name: '', type: 'CHECKING', iban: '', accountNumber: '', isPrimary: false });
  };

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-6 shadow-elevated">
          <div className="text-sm text-nf-text-muted">Lade Konten…</div>
        </div>
      );
    }
    if (error) {
      return (
        <div className="rounded-3xl border border-nf-negative/30 bg-nf-negative/10 p-6 shadow-elevated">
          <div className="text-sm text-nf-negative">{error}</div>
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        {/* Add Form */}
        {showAddForm && (
          <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-6 shadow-elevated">
            <form onSubmit={handleAddAccount} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-nf-text-main mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl border border-nf-border-subtle bg-nf-bg-card px-3 py-2 text-sm text-nf-text-main outline-none focus:border-nf-primary focus:ring-2 focus:ring-nf-primary/20"
                    placeholder="z.B. Hauptkonto"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-nf-text-main mb-1">
                    Typ *
                  </label>
                  <select
                    required
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value as AccountType })}
                    className="w-full rounded-xl border border-nf-border-subtle bg-nf-bg-card px-3 py-2 text-sm text-nf-text-main outline-none focus:border-nf-primary focus:ring-2 focus:ring-nf-primary/20"
                  >
                    {TYPE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-nf-text-main mb-1">
                    IBAN
                  </label>
                  <input
                    type="text"
                    value={formData.iban}
                    onChange={e => setFormData({ ...formData, iban: e.target.value })}
                    className="w-full rounded-xl border border-nf-border-subtle bg-nf-bg-card px-3 py-2 text-sm text-nf-text-main outline-none focus:border-nf-primary focus:ring-2 focus:ring-nf-primary/20"
                    placeholder="DE89 3704 0044..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-nf-text-main mb-1">
                    Kontonummer
                  </label>
                  <input
                    type="text"
                    value={formData.accountNumber}
                    onChange={e => setFormData({ ...formData, accountNumber: e.target.value })}
                    className="w-full rounded-xl border border-nf-border-subtle bg-nf-bg-card px-3 py-2 text-sm text-nf-text-main outline-none focus:border-nf-primary focus:ring-2 focus:ring-nf-primary/20"
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPrimary"
                  checked={formData.isPrimary}
                  onChange={e => setFormData({ ...formData, isPrimary: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-nf-primary focus:ring-nf-primary"
                />
                <label htmlFor="isPrimary" className="text-sm text-nf-text-main">
                  Als primäres Konto markieren
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-nf-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-nf-primary/90"
                >
                  <Check className="h-4 w-4" />
                  Hinzufügen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setFormData({ name: '', type: 'CHECKING', iban: '', accountNumber: '', isPrimary: false });
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-nf-border-subtle bg-nf-bg-card px-4 py-2 text-sm font-medium text-nf-text-main transition hover:bg-nf-bg-card-subtle"
                >
                  <X className="h-4 w-4" />
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Accounts List */}
        {items.length === 0 && !showAddForm ? (
          <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-6 shadow-elevated text-center">
            <div className="text-sm text-nf-text-muted mb-4">
              Noch keine Konten angelegt.
            </div>
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-nf-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-nf-primary/90"
            >
              <Plus className="h-4 w-4" />
              Konto hinzufügen
            </button>
          </div>
        ) : (
          <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card shadow-elevated overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-nf-bg-card-subtle text-nf-text-muted">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Typ</th>
                    <th className="px-4 py-3 font-medium">IBAN</th>
                    <th className="px-4 py-3 font-medium">Kontonummer</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-nf-border-subtle">
                  {items.map(acc => (
                    <tr key={acc.id} className="hover:bg-nf-bg-card-subtle/50 transition-colors">
                      <td className="px-4 py-3">
                        {editingId === acc.id ? (
                          <input
                            autoFocus
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full rounded-lg border border-nf-border-subtle bg-nf-bg-card px-2 py-1 text-sm text-nf-text-main outline-none focus:border-nf-primary focus:ring-2 focus:ring-nf-primary/20"
                            maxLength={80}
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-nf-text-main">{acc.name}</span>
                            {acc.isPrimary && (
                              <span className="inline-flex items-center rounded-full bg-nf-primary/20 px-2 py-0.5 text-[10px] font-medium text-nf-primary">
                                Primär
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === acc.id ? (
                          <select
                            value={formData.type}
                            onChange={e => setFormData({ ...formData, type: e.target.value as AccountType })}
                            className="w-full rounded-lg border border-nf-border-subtle bg-nf-bg-card px-2 py-1 text-sm text-nf-text-main outline-none focus:border-nf-primary focus:ring-2 focus:ring-nf-primary/20"
                          >
                            {TYPE_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-nf-text-main">
                            {TYPE_OPTIONS.find(o => o.value === acc.type)?.label || acc.type}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === acc.id ? (
                          <input
                            type="text"
                            value={formData.iban}
                            onChange={e => setFormData({ ...formData, iban: e.target.value })}
                            className="w-full rounded-lg border border-nf-border-subtle bg-nf-bg-card px-2 py-1 text-sm text-nf-text-main outline-none focus:border-nf-primary focus:ring-2 focus:ring-nf-primary/20"
                          />
                        ) : (
                          <span className="text-nf-text-muted">{acc.iban || '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === acc.id ? (
                          <input
                            type="text"
                            value={formData.accountNumber}
                            onChange={e => setFormData({ ...formData, accountNumber: e.target.value })}
                            className="w-full rounded-lg border border-nf-border-subtle bg-nf-bg-card px-2 py-1 text-sm text-nf-text-main outline-none focus:border-nf-primary focus:ring-2 focus:ring-nf-primary/20"
                          />
                        ) : (
                          <span className="text-nf-text-muted">{acc.accountNumber || '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === acc.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={formData.isPrimary}
                              onChange={e => setFormData({ ...formData, isPrimary: e.target.checked })}
                              className="h-4 w-4 rounded border-slate-300 text-nf-primary focus:ring-nf-primary"
                            />
                            <span className="text-xs text-nf-text-muted">Primär</span>
                          </div>
                        ) : (
                          <span className="text-xs text-nf-text-muted">
                            {acc.isPrimary ? 'Primär' : '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {editingId === acc.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUpdateAccount(acc.id, {
                                  name: formData.name,
                                  type: formData.type,
                                  iban: formData.iban || null,
                                  accountNumber: formData.accountNumber || null,
                                  isPrimary: formData.isPrimary,
                                })}
                                className="inline-flex items-center gap-1 rounded-lg bg-nf-primary px-2 py-1 text-xs font-medium text-white transition hover:bg-nf-primary/90"
                              >
                                <Check className="h-3 w-3" />
                                Speichern
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="inline-flex items-center gap-1 rounded-lg border border-nf-border-subtle bg-nf-bg-card px-2 py-1 text-xs font-medium text-nf-text-main transition hover:bg-nf-bg-card-subtle"
                              >
                                <X className="h-3 w-3" />
                                Abbrechen
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEdit(acc)}
                                className="inline-flex items-center gap-1 rounded-lg border border-nf-border-subtle bg-nf-bg-card px-2 py-1 text-xs font-medium text-nf-text-main transition hover:bg-nf-bg-card-subtle"
                                title="Bearbeiten"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAccount(acc.id)}
                                disabled={deletingId === acc.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-nf-negative/30 bg-nf-negative/10 px-2 py-1 text-xs font-medium text-nf-negative transition hover:bg-nf-negative/20 disabled:opacity-50"
                                title="Löschen"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }, [items, loading, error, showAddForm, editingId, formData, deletingId]);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-nf-text-main">Konten verwalten</h1>
            <p className="text-sm text-nf-text-muted mt-1">
              Verwalte deine Konten und ihre Identifikatoren. IBAN und Kontonummer helfen bei der Erkennung interner Überträge.
            </p>
          </div>
          {!showAddForm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-nf-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-nf-primary/90"
            >
              <Plus className="h-4 w-4" />
              Konto hinzufügen
            </button>
          )}
        </header>
        {content}
      </div>
    </AppShell>
  );
};

export default AccountsPage;


