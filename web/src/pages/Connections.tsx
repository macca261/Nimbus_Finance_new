import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type ProviderAccount = {
  id: string;
  provider: string;
  providerAccountId: string;
  institutionName?: string;
  mask?: string;
  jobs?: { id: string; status: string; createdAt: string }[];
};

export default function ConnectionsPage() {
  const [accounts, setAccounts] = useState<ProviderAccount[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const { data } = await api.get('/providers/accounts');
      setAccounts(data);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load connections');
    }
  }
  useEffect(() => { load(); }, []);

  async function connect(provider: string) {
    setError(null);
    try {
      const { data } = await api.post(`/providers/${provider}/connect`);
      location.href = data.url;
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.response?.data?.error || 'Connect failed');
    }
  }

  async function manualSync(id: string) {
    setError(null);
    try { await api.post(`/providers/${id}/sync`); load(); } catch (e: any) { setError(e?.response?.data?.error || 'Sync failed'); }
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Bank Connections</h1>
      {error && <div className="alert alert-error mb-3 text-sm">{error}</div>}
      <div className="flex items-center gap-2 mb-4">
        <button className="btn btn-sm" onClick={() => connect('finapi')}>Connect finAPI</button>
        <button className="btn btn-sm" onClick={() => connect('tink')}>Connect Tink</button>
        <button className="btn btn-sm" onClick={() => connect('nordigen')}>Connect Nordigen</button>
      </div>
      <div className="border rounded">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="p-2">Provider</th>
              <th className="p-2">Institution</th>
              <th className="p-2">Account</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(a => (
              <tr key={a.id} className="border-t">
                <td className="p-2 capitalize">{a.provider}</td>
                <td className="p-2">{a.institutionName || '—'}</td>
                <td className="p-2">{a.providerAccountId} {a.mask ? `(${a.mask})` : ''}</td>
                <td className="p-2">
                  <button className="btn btn-xs" onClick={() => manualSync(a.id)}>Sync</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


