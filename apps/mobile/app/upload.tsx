import { useState } from 'react';
import { View, Text, Button } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { api } from '../src/api';

export default function UploadScreen() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function pickAndUpload() {
    setError(null); setResult(null);
    const doc = await DocumentPicker.getDocumentAsync({ type: 'text/csv' });
    if (doc.canceled || !doc.assets?.length) return;
    const asset = doc.assets[0];
    const form = new FormData();
    // @ts-ignore
    form.append('file', { uri: asset.uri, name: asset.name || 'upload.csv', type: 'text/csv' });
    try {
      const { data } = await api.post('/imports/csv', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(data);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Upload failed');
    }
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 12 }}>Upload CSV</Text>
      <Button title="Pick and Upload CSV" onPress={pickAndUpload} />
      {error ? <Text style={{ color: 'red', marginTop: 12 }}>{error}</Text> : null}
      {result ? <Text style={{ marginTop: 12 }}>{JSON.stringify(result)}</Text> : null}
    </View>
  );
}


