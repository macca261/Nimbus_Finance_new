import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAccounts } from '../useAccounts';
import * as accountsApi from '../../api/accountsApi';

// Mock the API
vi.mock('../../api/accountsApi');

describe('useAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load accounts on mount', async () => {
    const mockAccounts: accountsApi.Account[] = [
      {
        id: 'acc1',
        name: 'Girokonto',
        type: 'CHECKING',
        iban: 'DE89370400440532013000',
        isPrimary: true,
        isArchived: false,
        userId: 'default',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ];

    vi.mocked(accountsApi.fetchAccounts).mockResolvedValue(mockAccounts);

    const { result } = renderHook(() => useAccounts());

    expect(result.current.loading).toBe(true);
    expect(result.current.accounts).toEqual([]);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.accounts).toEqual(mockAccounts);
    expect(result.current.error).toBeNull();
  });

  it('should handle errors', async () => {
    const error = new Error('Failed to load');
    vi.mocked(accountsApi.fetchAccounts).mockRejectedValue(error);

    const { result } = renderHook(() => useAccounts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.accounts).toEqual([]);
    expect(result.current.error).toBe('Failed to load');
  });

  it('should provide refetch function', async () => {
    const mockAccounts: accountsApi.Account[] = [];
    vi.mocked(accountsApi.fetchAccounts).mockResolvedValue(mockAccounts);

    const { result } = renderHook(() => useAccounts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(typeof result.current.refetch).toBe('function');

    const newAccounts: accountsApi.Account[] = [
      {
        id: 'acc2',
        name: 'Sparkonto',
        type: 'SAVINGS',
        isPrimary: false,
        isArchived: false,
        userId: 'default',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ];

    vi.mocked(accountsApi.fetchAccounts).mockResolvedValue(newAccounts);

    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.accounts).toEqual(newAccounts);
    });
  });
});

