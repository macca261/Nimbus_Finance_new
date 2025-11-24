import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { evaluateQuietly } from '../evaluateQuietly';
import { evaluateAchievements } from '../../../api/achievementsApi';

vi.mock('../../../api/achievementsApi');

describe('evaluateQuietly', () => {
  const mockEvaluateAchievements = vi.mocked(evaluateAchievements);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls evaluateAchievements immediately if enough time has passed', async () => {
    mockEvaluateAchievements.mockResolvedValue([]);

    const promise = evaluateQuietly();
    await vi.runAllTimersAsync();
    await promise;

    expect(mockEvaluateAchievements).toHaveBeenCalledTimes(1);
  });

  it('debounces rapid calls', async () => {
    mockEvaluateAchievements.mockResolvedValue([]);

    evaluateQuietly();
    evaluateQuietly();
    evaluateQuietly();

    await vi.advanceTimersByTimeAsync(2000);
    await vi.runAllTimersAsync();

    // Should only call once due to debouncing
    expect(mockEvaluateAchievements).toHaveBeenCalledTimes(1);
  });

  it('handles errors silently', async () => {
    mockEvaluateAchievements.mockRejectedValue(new Error('API error'));
    const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    const promise = evaluateQuietly();
    await vi.runAllTimersAsync();
    await promise;

    expect(mockEvaluateAchievements).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[achievements]'),
      expect.anything()
    );

    consoleSpy.mockRestore();
  });

  it('respects minimum interval between evaluations', async () => {
    mockEvaluateAchievements.mockResolvedValue([]);

    // First call
    await evaluateQuietly();
    await vi.runAllTimersAsync();

    // Second call immediately after (should be debounced)
    evaluateQuietly();
    await vi.advanceTimersByTimeAsync(2000);
    await vi.runAllTimersAsync();

    // Should have been called twice (first immediately, second after debounce)
    expect(mockEvaluateAchievements).toHaveBeenCalledTimes(2);
  });
});

