import { useInfiniteQuery } from '@tanstack/react-query';
import { View, Text, FlatList } from 'react-native';
import { api } from '../../src/api';
import ExplainChip from '../../src/components/ExplainChip';

async function fetchPage({ pageParam = 0, pageSize = 50 }) {
  const { data } = await api.get('/transactions', { params: { offset: pageParam, limit: pageSize } });
  return data;
}

export default function TransactionsScreen() {
  const { data, fetchNextPage, hasNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['transactions'],
    queryFn: ({ pageParam }) => fetchPage({ pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((acc, p) => acc + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    }
  });

  const items = data?.pages.flatMap((p: any) => p.items) || [];

  return (
    <View style={{ flex: 1, padding: 12 }}>
      {isLoading ? <Text>Loading…</Text> : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.5}
          renderItem={({ item }) => (
            <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '600' }}>{item.counterpartName || '—'}</Text>
                <Text>{item.amount.toFixed(2)} {item.currency || 'EUR'}</Text>
              </View>
              <Text style={{ color: '#6b7280' }}>{item.purpose}</Text>
              {item.explain && <ExplainChip method={item.explain.method} confidence={item.explain.confidence} reason={item.explain.reason} />}
            </View>
          )}
        />
      )}
    </View>
  );
}


