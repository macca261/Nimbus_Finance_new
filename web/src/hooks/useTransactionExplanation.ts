/**
 * useTransactionExplanation Hook
 * 
 * Fetches categorization explanation for a transaction.
 * Only loads when transactionId is provided.
 */

import { useEffect, useState } from 'react';
import { fetchTransactionExplanation, type TransactionExplanation } from '../api/transactionsApi';

interface UseTransactionExplanation {
  data: TransactionExplanation | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useTransactionExplanation(
  transactionId: number | string | null
): UseTransactionExplanation {
  const [data, setData] = useState<TransactionExplanation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = async () => {
    if (transactionId == null) return;

    try {
      setIsLoading(true);
      setError(null);
      const result = await fetchTransactionExplanation(transactionId);
      setData(result);
    } catch (err: any) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[useTransactionExplanation] Failed to fetch', err);
      }
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setData(null);
    setError(null);
    if (transactionId != null) {
      void load();
    }
  }, [transactionId]);

  return { data, isLoading, error, refetch: load };
}

