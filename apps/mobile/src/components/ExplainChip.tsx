import { View, Text } from 'react-native';

export default function ExplainChip({ method, confidence, reason }: { method: 'rule' | 'ml' | 'ai'; confidence: number; reason?: string }) {
  const color = method === 'rule' ? '#065f46' : method === 'ml' ? '#1e3a8a' : '#6d28d9';
  return (
    <View style={{ backgroundColor: '#eef2ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, flexDirection: 'row', alignItems: 'center' }}>
      <Text style={{ color, fontWeight: '600', marginRight: 6 }}>{method.toUpperCase()}</Text>
      <Text style={{ color: '#374151' }}>{Math.round(confidence * 100)}%</Text>
      {reason ? <Text numberOfLines={1} style={{ color: '#6b7280', marginLeft: 6, maxWidth: 160 }}>· {reason}</Text> : null}
    </View>
  );
}


