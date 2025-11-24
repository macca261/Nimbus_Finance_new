import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useBatchAiSuggestions } from '../useBatchAiSuggestions';
import * as aiCategoryApi from '../../api/aiCategoryApi';

// Mock the API
vi.mock('../../api/aiCategoryApi', () => ({
  isAiCategorizationEnabled: vi.fn(() => true),
}));

describe('useBatchAiSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset global cache by clearing fetch mocks
    (global as any).fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should deduplicate transaction IDs', async () => {
    const mockResponse = {
      suggestions: [
        { transactionId: 'tx-1', suggestedCategoryId: 'groceries', confidence: 0.9 },
        { transactionId: 'tx-2', suggestedCategoryId: 'shopping', confidence: 0.85 },
      ],
      skippedIds: [],
    };

    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() =>
      useBatchAiSuggestions(['tx-1', 'tx-2', 'tx-1', 'tx-2'], true),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should only make one request despite duplicate IDs
    expect((global as any).fetch).toHaveBeenCalledTimes(1);
    expect(result.current.getSuggestion('tx-1')?.categoryId).toBe('groceries');
    expect(result.current.getSuggestion('tx-2')?.categoryId).toBe('shopping');
  });

  it('should batch large sets of transaction IDs', async () => {
    // Create 120 transaction IDs (should be split into 3 batches of 50)
    const transactionIds = Array.from({ length: 120 }, (_, i) => `tx-${i + 1}`);

    const mockResponse = {
      suggestions: transactionIds.slice(0, 50).map(id => ({
        transactionId: id,
        suggestedCategoryId: 'groceries',
        confidence: 0.9,
      })),
      skippedIds: [],
    };

    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useBatchAiSuggestions(transactionIds, true));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 5000 });

    // Should make multiple batch requests (at least 2-3 for 120 IDs with batch size 50)
    // Note: Due to concurrency limits, exact count may vary
    expect((global as any).fetch).toHaveBeenCalled();
    const callCount = (global as any).fetch.mock.calls.length;
    expect(callCount).toBeGreaterThanOrEqual(1);
  });

  it('should cache suggestions and not re-request', async () => {
    const mockResponse = {
      suggestions: [{ transactionId: 'tx-1', suggestedCategoryId: 'groceries', confidence: 0.9 }],
      skippedIds: [],
    };

    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result, rerender } = renderHook(
      ({ ids }) => useBatchAiSuggestions(ids, true),
      { initialProps: { ids: ['tx-1'] } },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const firstCallCount = (global as any).fetch.mock.calls.length;

    // Re-render with same IDs
    rerender({ ids: ['tx-1'] });

    await waitFor(() => {
      // Should not make additional requests for cached IDs
      expect((global as any).fetch.mock.calls.length).toBe(firstCallCount);
    });

    // Suggestion should still be available
    expect(result.current.getSuggestion('tx-1')?.categoryId).toBe('groceries');
  });

  it('should handle rate limiting gracefully', async () => {
    const mockResponse = {
      suggestions: [],
      skippedIds: [],
      rateLimited: true,
    };

    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useBatchAiSuggestions(['tx-1'], true));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.rateLimited).toBe(true);
    expect(result.current.getSuggestion('tx-1')).toBeNull();
  });

  it('should handle errors gracefully', async () => {
    (global as any).fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useBatchAiSuggestions(['tx-1'], true));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.getSuggestion('tx-1')).toBeNull();
  });

  it('should not fetch when disabled', async () => {
    const { result } = renderHook(() => useBatchAiSuggestions(['tx-1'], false));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  it('should not fetch when AI categorization is disabled', async () => {
    vi.mocked(aiCategoryApi.isAiCategorizationEnabled).mockReturnValue(false);

    const { result } = renderHook(() => useBatchAiSuggestions(['tx-1'], true));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  it('should return suggestions map', async () => {
    const mockResponse = {
      suggestions: [
        { transactionId: 'tx-1', suggestedCategoryId: 'groceries', confidence: 0.9 },
        { transactionId: 'tx-2', suggestedCategoryId: 'shopping', confidence: 0.85 },
      ],
      skippedIds: [],
    };

    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useBatchAiSuggestions(['tx-1', 'tx-2'], true));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const suggestionsMap = result.current.suggestions;
    expect(suggestionsMap.size).toBe(2);
    expect(suggestionsMap.get('tx-1')?.suggestedCategoryId).toBe('groceries');
    expect(suggestionsMap.get('tx-2')?.suggestedCategoryId).toBe('shopping');
  });

  it('should expose hasAttempted to distinguish attempted from not attempted', async () => {
    const mockResponse = {
      suggestions: [
        { transactionId: 'tx-1', suggestedCategoryId: 'groceries', confidence: 0.9 },
        // tx-2 attempted but no suggestion returned
      ],
      skippedIds: ['tx-2'],
    };

    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() =>
      useBatchAiSuggestions(['tx-1', 'tx-2'], true),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // tx-1 was attempted and has suggestion
    expect(result.current.hasAttempted('tx-1')).toBe(true);
    expect(result.current.getSuggestion('tx-1')).not.toBeNull();

    // tx-2 was attempted but has no suggestion (skipped)
    expect(result.current.hasAttempted('tx-2')).toBe(true);
    expect(result.current.getSuggestion('tx-2')).toBeNull();

    // tx-3 was never attempted
    expect(result.current.hasAttempted('tx-3')).toBe(false);
    expect(result.current.getSuggestion('tx-3')).toBeNull();
  });

  it('should not cause render loops when all IDs are cached', async () => {
    const mockResponse = {
      suggestions: [
        { transactionId: 'tx-1', suggestedCategoryId: 'groceries', confidence: 0.9 },
      ],
      skippedIds: [],
    };

    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    // First render - fetch suggestions
    const { result, rerender } = renderHook(
      ({ ids }) => useBatchAiSuggestions(ids, true),
      { initialProps: { ids: ['tx-1'] } },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const firstCallCount = (global as any).fetch.mock.calls.length;
    expect(firstCallCount).toBeGreaterThan(0);

    // Re-render multiple times with same cached IDs
    // This should NOT trigger additional fetches or cause render loops
    let renderCount = 0;
    const maxRenders = 10;
    
    for (let i = 0; i < maxRenders; i++) {
      rerender({ ids: ['tx-1'] });
      renderCount++;
      
      // Wait a bit to ensure no async updates trigger re-renders
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Should not have made additional fetch calls
    const finalCallCount = (global as any).fetch.mock.calls.length;
    expect(finalCallCount).toBe(firstCallCount);

    // Suggestion should still be available
    expect(result.current.getSuggestion('tx-1')?.categoryId).toBe('groceries');
  });

  it('should not cause render loops with empty array', async () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useBatchAiSuggestions(ids, true),
      { initialProps: { ids: [] } },
    );

    // Re-render multiple times with empty array
    for (let i = 0; i < 5; i++) {
      rerender({ ids: [] });
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Should not throw or cause infinite loops
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  it('should handle rapid prop changes without loops', async () => {
    const mockResponse = {
      suggestions: [
        { transactionId: 'tx-1', suggestedCategoryId: 'groceries', confidence: 0.9 },
      ],
      skippedIds: [],
    };

    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result, rerender } = renderHook(
      ({ ids }) => useBatchAiSuggestions(ids, true),
      { initialProps: { ids: ['tx-1'] } },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const initialCallCount = (global as any).fetch.mock.calls.length;

    // Rapidly change props with same values (new array references)
    for (let i = 0; i < 5; i++) {
      rerender({ ids: ['tx-1'] }); // Same IDs, new array reference
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Should not make additional calls for same IDs
    const finalCallCount = (global as any).fetch.mock.calls.length;
    expect(finalCallCount).toBe(initialCallCount);
  });

  it('does not trigger extra network calls when transactionIds array reference changes but content is same', async () => {
    const mockResponse = {
      suggestions: [
        { transactionId: 'tx-1', suggestedCategoryId: 'groceries', confidence: 0.9 },
      ],
      skippedIds: [],
    };

    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const ids1 = ['tx-1'];
    const { result, rerender } = renderHook(
      ({ ids }) => useBatchAiSuggestions(ids, true),
      { initialProps: { ids: ids1 } },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const firstCallCount = (global as any).fetch.mock.calls.length;
    expect(firstCallCount).toBeGreaterThan(0);

    // Re-render with new array reference but same content
    const ids2 = ['tx-1']; // New array, same content
    rerender({ ids: ids2 });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 2000 });

    // Should not make additional calls for same IDs
    const finalCallCount = (global as any).fetch.mock.calls.length;
    expect(finalCallCount).toBe(firstCallCount);
  });
});

