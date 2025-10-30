import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type ProviderAccount = {
  id: string;
  institutionName?: string | null;
  mask?: string | null;
  jobs: { id: string; finishedAt: string | null }[];
};

export default function BankConnections() {
  const [accounts, setAccounts] = useState<ProviderAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const token = localStorage.getItem('token');

  async function fetchAccounts() {
    try {
      setLoading(true);
      const res = await api.get('/api/providers/accounts', { headers: { Authorization: `Bearer ${token}` } });
      setAccounts(res.data || []);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAccounts(); }, []);

  async function handleConnectEU() {
    try {
      setConnecting(true);
      const res = await api.post('/api/providers/nordigen/connect', {}, { headers: { Authorization: `Bearer ${token}` } });
      window.location.href = res.data.url;
    } finally {
      setConnecting(false);
    }
  }

  async function handleSync(id: string) {
    await api.post(`/api/providers/${id}/sync`, {}, { headers: { Authorization: `Bearer ${token}` } });
    await fetchAccounts();
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold mb-4">Bank Connections</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="border rounded-lg p-4 text-center">
          <div className="text-2xl mb-2">🇪🇺</div>
          <h3 className="font-semibold mb-2">European Banks</h3>
          <p className="text-sm text-gray-600 mb-4">Connect your German or EU bank account</p>
          <button onClick={handleConnectEU} disabled={connecting} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
            {connecting ? 'Connecting...' : 'Connect EU Bank'}
          </button>
        </div>
        <div className="border rounded-lg p-4 text-center opacity-70">
          <div className="text-2xl mb-2">🇺🇸</div>
          <h3 className="font-semibold mb-2">International Banks</h3>
          <p className="text-sm text-gray-600 mb-4">Connect US, UK, or other international accounts</p>
          <button disabled className="bg-gray-400 text-white px-4 py-2 rounded cursor-not-allowed">Coming Soon</button>
        </div>
      </div>
      {accounts.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">Connected Accounts</h3>
          <div className="space-y-3">
            {accounts.map(a => (
              <div key={a.id} className="border rounded-lg p-4 flex justify-between items-center">
                <div>
                  <div className="font-medium">{a.institutionName ?? 'Unknown Institution'}</div>
                  <div className="text-sm text-gray-600">•••• {a.mask ?? '----'}</div>
                  <div className="text-sm text-gray-500">Last sync: {a.jobs[0]?.finishedAt ? new Date(a.jobs[0].finishedAt).toLocaleDateString() : 'Never'}</div>
                </div>
                <button onClick={() => handleSync(a.id)} className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">Sync Now</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


