import { useState, useEffect } from 'react';
import { fetchAccounts, type Account } from '../api/accountsApi';

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchAccounts({ includeArchived: false });
        if (!cancelled) {
          setAccounts(data);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Fehler beim Laden der Konten');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const refetch = async () => {
    try {
      const data = await fetchAccounts({ includeArchived: false });
      setAccounts(data);
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Laden der Konten');
    }
  };

  return { accounts, loading, error, refetch };
}

/**
 * Get account name by ID.
 */
export function useAccountName(accountId: string | null | undefined): string | null {
  const { accounts } = useAccounts();
  
  if (!accountId) {
    return null;
  }
  
  const account = accounts.find(a => a.id === accountId);
  return account?.name || null;
}

