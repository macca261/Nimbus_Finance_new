import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCoachStory } from '../useCoachStory';
import * as coachApi from '../../api/coachApi';
import { emitDataMutated } from '../../lib/dataEvents';

// Mock the API
vi.mock('../../api/coachApi', () => ({
  fetchCoachStory: vi.fn(),
}));

// Mock dataEvents - create a simple event emitter
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

describe('useCoachStory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListeners.length = 0; // Clear listeners
  });

  it('fetches story on mount when autoFetch is true', async () => {
    const mockStory = {
      story: {
        title: 'Test Story',
        insights: ['Insight 1', 'Insight 2'],
        actions: ['Action 1'],
      },
    };

    vi.mocked(coachApi.fetchCoachStory).mockResolvedValue(mockStory);

    const { result } = renderHook(() => useCoachStory({ days: 30, autoFetch: true }));

    expect(result.current.isLoading).toBe(true);
    expect(coachApi.fetchCoachStory).toHaveBeenCalledWith(30);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.story).not.toBeNull();
    expect(result.current.story?.story).toEqual(mockStory.story);
    expect(result.current.error).toBeNull();
  });

  it('does not fetch on mount when autoFetch is false', () => {
    renderHook(() => useCoachStory({ days: 30, autoFetch: false }));

    expect(coachApi.fetchCoachStory).not.toHaveBeenCalled();
  });

  it('handles API errors gracefully', async () => {
    const error = new Error('Network error');
    vi.mocked(coachApi.fetchCoachStory).mockRejectedValue(error);

    const { result } = renderHook(() => useCoachStory({ days: 30, autoFetch: true }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.story).toBeNull();
  });

  it('refetches when refetch is called', async () => {
    const mockStory = {
      story: {
        title: 'Test Story',
        insights: ['Insight 1'],
        actions: ['Action 1'],
      },
    };

    vi.mocked(coachApi.fetchCoachStory).mockResolvedValue(mockStory);

    const { result } = renderHook(() => useCoachStory({ days: 30, autoFetch: false }));

    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(coachApi.fetchCoachStory).toHaveBeenCalledWith(30);
    expect(result.current.story).not.toBeNull();
    expect(result.current.story?.story).toEqual(mockStory.story);
  });

  it('handles disabled response', async () => {
    const disabledResponse = {
      story: null,
      disabled: true,
      message: 'AI coach is disabled.',
    };

    vi.mocked(coachApi.fetchCoachStory).mockResolvedValue(disabledResponse);

    const { result } = renderHook(() => useCoachStory({ days: 30, autoFetch: true }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.story).toEqual(disabledResponse);
  });

  it('refetches when data mutation event is emitted', async () => {
    const mockStory = {
      story: {
        title: 'Test Story',
        insights: ['Insight 1'],
        actions: ['Action 1'],
      },
    };

    vi.mocked(coachApi.fetchCoachStory).mockResolvedValue(mockStory);

    const { result } = renderHook(() => useCoachStory({ days: 30, autoFetch: true }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Clear previous calls
    vi.clearAllMocks();
    vi.mocked(coachApi.fetchCoachStory).mockResolvedValue(mockStory);

    // Trigger data mutation event
    const { emitDataMutated } = await import('../../lib/dataEvents');
    emitDataMutated({ reason: 'imports:csv-uploaded' });

    await waitFor(() => {
      expect(coachApi.fetchCoachStory).toHaveBeenCalled();
    }, { timeout: 1000 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
});

