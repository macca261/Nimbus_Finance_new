import { useState } from 'react';
import { View, Text, Button, TextInput } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export default function SettingsScreen() {
  const [token, setToken] = useState<string>('');
  const [tier, setTier] = useState<string>(localStorage?.getItem?.('tier') || 'free');

  async function saveToken() {
    await SecureStore.setItemAsync('jwt', token);
    alert('Saved token');
  }

  function saveTier() {
    try { localStorage.setItem('tier', tier); } catch {}
    alert('Saved plan');
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 12 }}>Settings</Text>
      <Text style={{ fontWeight: '600' }}>JWT Token</Text>
      <TextInput value={token} onChangeText={setToken} placeholder="Paste token" style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8, marginBottom: 12 }} />
      <Button title="Save Token" onPress={saveToken} />
      <View style={{ height: 16 }} />
      <Text style={{ fontWeight: '600' }}>Plan</Text>
      <TextInput value={tier} onChangeText={setTier} placeholder="free | pro_lite | pro_plus" style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8, marginBottom: 12 }} />
      <Button title="Save Plan" onPress={saveTier} />
    </View>
  );
}


