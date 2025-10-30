import { useQuery } from '@tanstack/react-query';
import { View, Text, ScrollView } from 'react-native';
import { api } from '../../src/api';

export default function DashboardScreen() {
  const today = new Date();
  const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const { data: summary } = useQuery({
    queryKey: ['monthly', ym],
    queryFn: async () => (await api.get('/insights/monthly-summary', { params: { month: ym } })).data,
  });
  const { data: recurring } = useQuery({ queryKey: ['recurring'], queryFn: async () => (await api.get('/insights/recurring')).data });

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '600', marginBottom: 12 }}>Dashboard</Text>
      {summary && (
        <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <Text style={{ fontWeight: '600' }}>Monthly net</Text>
          <Text style={{ fontSize: 18 }}>{(summary.net).toFixed(2)} EUR</Text>
        </View>
      )}
      {recurring?.items?.length ? (
        <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 12 }}>
          <Text style={{ fontWeight: '600', marginBottom: 8 }}>Subscriptions</Text>
          {recurring.items.slice(0, 5).map((r: any, idx: number) => (
            <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
              <Text>{r.merchant}</Text>
              <Text>{r.amount.toFixed(2)} EUR</Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}


