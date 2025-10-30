import { useEffect, useState } from 'react';
import { View, Text, Button } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { api } from '../../src/api';

type ProviderAccount = { id: string; provider: string; providerAccountId: string; institutionName?: string };

export default function ConnectScreen() {
  const [accounts, setAccounts] = useState<ProviderAccount[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try { const { data } = await api.get('/providers/accounts'); setAccounts(data); } catch (e: any) { setError(e?.response?.data?.error || 'Failed to load'); }
  }
  useEffect(() => { load(); }, []);

  async function connect(provider: string) {
    setError(null);
    try {
      const { data } = await api.post(`/providers/${provider}/connect`);
      await WebBrowser.openAuthSessionAsync(data.url, 'nimbus://oauth');
      // poll until account appears
      const started = Date.now();
      while (Date.now() - started < 60000) {
        await new Promise(r => setTimeout(r, 2000));
        try { const res = await api.get('/providers/accounts'); setAccounts(res.data); if (res.data.length > accounts.length) break; } catch {}
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.response?.data?.error || 'Connect failed');
    }
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 12 }}>Connect a bank</Text>
      {error ? <Text style={{ color: 'red' }}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <Button title="finAPI" onPress={() => connect('finapi')} />
        <Button title="Tink" onPress={() => connect('tink')} />
        <Button title="Nordigen" onPress={() => connect('nordigen')} />
      </View>
      {accounts.map(a => (
        <View key={a.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
          <Text style={{ fontWeight: '600' }}>{a.institutionName || a.provider}</Text>
          <Text style={{ color: '#6b7280' }}>{a.providerAccountId}</Text>
        </View>
      ))}
    </View>
  );
}


