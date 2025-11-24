import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useMonthSummary } from '../useMonthSummary';
import api from '../../lib/api';
import { emitDataMutated } from '../../lib/dataEvents';

// Mock the API
vi.mock('../../lib/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

// Mock dataEvents
const mockListeners: Array<(detail: any) => void> = [];
vi.mock('../../lib/dataEvents', () => ({
  subscribeToDataMutations: (listener: (detail: any) => void) => {
    mockListeners.push(listener);
    return () => {
      const index = mockListeners.indexOf(listener);
      if (index > -1) mockListeners.splice(index, 1);
    };
  },
  emitDataMutated: vi.fn((detail?: any) => {
    mockListeners.forEach(listener => listener(detail));
  }),
}));

describe('useMonthSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListeners.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches summary on mount when autoFetch is true', async () => {
    const mockResponse = {
      data: {
        summary: {
          period: { start: '2024-01-01', end: '2024-01-31' },
          incomeCents: 300000,
          expenseCents: 50000,
          netCents: 250000,
          changeVsPrevMonthPct: 10.5,
          topCategories: [],
          biggestExpense: null,
          highlights: [],
        },
        narrative: {
          bullets: ['Bullet 1', 'Bullet 2', 'Bullet 3'],
        },
      },
    };

    vi.mocked(api.get).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useMonthSummary({ autoFetch: true }));

    expect(result.current.isLoading).toBe(true);
    expect(api.get).toHaveBeenCalledWith('/summary/month-narrative?');

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).not.toBeNull();
    expect(result.current.data?.summary.incomeCents).toBe(300000);
    expect(result.current.data?.narrative.bullets.length).toBe(3);
    expect(result.current.error).toBeNull();
  });

  it('does not fetch on mount when autoFetch is false', () => {
    renderHook(() => useMonthSummary({ autoFetch: false }));

    expect(api.get).not.toHaveBeenCalled();
  });

  it('handles API errors gracefully', async () => {
    const error = new Error('Network error');
    vi.mocked(api.get).mockRejectedValue(error);

    const { result } = renderHook(() => useMonthSummary({ autoFetch: true }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.data).toBeNull();
  });

  it('handles 404/503 by falling back to numeric summary', async () => {
    const error404 = { response: { status: 404 } };
    const numericResponse = {
      data: {
        summary: {
          period: { start: '2024-01-01', end: '2024-01-31' },
          incomeCents: 300000,
          expenseCents: 50000,
          netCents: 250000,
          changeVsPrevMonthPct: null,
          topCategories: [],
          biggestExpense: null,
          highlights: [],
        },
      },
    };

    vi.mocked(api.get)
      .mockRejectedValueOnce(error404)
      .mockResolvedValueOnce(numericResponse);

    const { result } = renderHook(() => useMonthSummary({ autoFetch: true }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).not.toBeNull();
    expect(result.current.data?.summary).toBeDefined();
    expect(result.current.data?.narrative.bullets).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('refetches when refetch is called', async () => {
    const mockResponse = {
      data: {
        summary: {
          period: { start: '2024-01-01', end: '2024-01-31' },
          incomeCents: 300000,
          expenseCents: 50000,
          netCents: 250000,
          changeVsPrevMonthPct: null,
          topCategories: [],
          biggestExpense: null,
          highlights: [],
        },
        narrative: { bullets: ['Test'] },
      },
    };

    vi.mocked(api.get).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useMonthSummary({ autoFetch: false }));

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(api.get).toHaveBeenCalled();
    expect(result.current.data).not.toBeNull();
  });

  it('refetches when data mutation event is emitted', async () => {
    const mockResponse = {
      data: {
        summary: {
          period: { start: '2024-01-01', end: '2024-01-31' },
          incomeCents: 300000,
          expenseCents: 50000,
          netCents: 250000,
          changeVsPrevMonthPct: null,
          topCategories: [],
          biggestExpense: null,
          highlights: [],
        },
        narrative: { bullets: ['Test'] },
      },
    };

    vi.mocked(api.get).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useMonthSummary({ autoFetch: true }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Clear previous calls
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue(mockResponse);

    // Trigger data mutation event
    act(() => {
      emitDataMutated({ reason: 'imports:csv-uploaded' });
    });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    }, { timeout: 1000 });
  });

  it('passes month parameter when provided', async () => {
    const mockResponse = {
      data: {
        summary: {
          period: { start: '2024-02-01', end: '2024-02-29' },
          incomeCents: 0,
          expenseCents: 0,
          netCents: 0,
          changeVsPrevMonthPct: null,
          topCategories: [],
          biggestExpense: null,
          highlights: [],
        },
        narrative: { bullets: [] },
      },
    };

    vi.mocked(api.get).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useMonthSummary({ month: '2024-02', autoFetch: true }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(api.get).toHaveBeenCalledWith('/summary/month-narrative?month=2024-02');
  });
});

