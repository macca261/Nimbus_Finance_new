/**
 * useBuckets Hook
 * 
 * React hook for managing buckets (virtual envelopes)
 */

import { useState, useEffect } from 'react';
import { getBuckets, createBucket, updateBucket, deleteBucket, type Bucket } from '../api/buckets';

export function useBuckets() {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBuckets = async () => {
    try {
      setIsLoading(true);
      const data = await getBuckets();
      setBuckets(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load buckets'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBuckets();
  }, []);

  const create = async (data: Parameters<typeof createBucket>[0]) => {
    const newBucket = await createBucket(data);
    setBuckets((prev) => [...prev, newBucket]);
    return newBucket;
  };

  const update = async (id: string, data: Parameters<typeof updateBucket>[1]) => {
    const updated = await updateBucket(id, data);
    setBuckets((prev) => prev.map((b) => (b.id === id ? updated : b)));
    return updated;
  };

  const remove = async (id: string) => {
    await deleteBucket(id);
    setBuckets((prev) => prev.filter((b) => b.id !== id));
  };

  return {
    buckets,
    isLoading,
    error,
    refetch: fetchBuckets,
    create,
    update,
    remove,
  };
}

