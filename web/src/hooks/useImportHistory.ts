import { useCallback, useEffect, useState } from 'react';

export type ImportHistoryEntry = {
  id?: string;
  fileName?: string;
  importedAt: string;
  profileId: string;
  confidence?: number;
  rowsImported?: number;
  warnings?: string[];
  status?: 'success' | 'warning' | 'error';
};

type ImportHistoryState = {
  loading: boolean;
  error: string | null;
  entries: ImportHistoryEntry[];
  refetch: () => void;
};

export function useImportHistory(): ImportHistoryState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<ImportHistoryEntry[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/import/history');
      if (!res.ok) {
        // Some deployments may not have this endpoint yet – degrade gracefully.
        setEntries([]);
        return;
      }
      const json = await res.json();
      const list = Array.isArray(json?.history) ? json.history : json;
      if (Array.isArray(list)) {
        setEntries(
          list.map(item => ({
            id: item.id ?? item.importId ?? item.fileName ?? item.importedAt,
            fileName: item.fileName ?? item.name ?? null,
            importedAt: item.importedAt ?? item.timestamp ?? new Date().toISOString(),
            profileId: item.profileId ?? 'unbekannt',
            confidence: typeof item.confidence === 'number' ? item.confidence : undefined,
            rowsImported:
              item.rowsImported ??
              item.transactionCount ??
              item.inserted ??
              item.insertedCount ??
              item.rows ??
              undefined,
            warnings: item.warnings ?? item.hints ?? [],
            status: item.status ?? (item.warnings?.length ? 'warning' : 'success'),
          })),
        );
      } else {
        setEntries([]);
      }
    } catch (err: any) {
      console.info('Import history not available yet', err?.message);
      setEntries([]);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    loading,
    error,
    entries,
    refetch: load,
  };
}


