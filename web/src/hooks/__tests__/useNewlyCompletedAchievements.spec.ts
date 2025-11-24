import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNewlyCompletedAchievements } from '../useNewlyCompletedAchievements';
import type { Achievement } from '../../types/achievements';
import { toast } from '../../lib/toast';

vi.mock('../../lib/toast');

describe('useNewlyCompletedAchievements', () => {
  const mockToast = vi.mocked(toast);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not show toast on initial render', () => {
    const achievements: Achievement[] = [
      {
        id: '1',
        key: 'first_import',
        title: 'Erster CSV-Import 🎉',
        description: 'Test',
        type: 'import',
        status: 'completed',
        progress: 100,
        unlockedAt: new Date().toISOString(),
      },
    ];

    renderHook(() => useNewlyCompletedAchievements(achievements));

    expect(mockToast).not.toHaveBeenCalled();
  });

  it('shows toast when achievement transitions to completed', () => {
    const initialAchievements: Achievement[] = [
      {
        id: '1',
        key: 'first_import',
        title: 'Erster CSV-Import 🎉',
        description: 'Test',
        type: 'import',
        status: 'in_progress',
        progress: 50,
      },
    ];

    const { rerender } = renderHook(
      ({ achievements }) => useNewlyCompletedAchievements(achievements),
      { initialProps: { achievements: initialAchievements } }
    );

    const completedAchievements: Achievement[] = [
      {
        id: '1',
        key: 'first_import',
        title: 'Erster CSV-Import 🎉',
        description: 'Test',
        type: 'import',
        status: 'completed',
        progress: 100,
        unlockedAt: new Date().toISOString(),
      },
    ];

    rerender({ achievements: completedAchievements });

    expect(mockToast).toHaveBeenCalledWith(
      'Neuer Erfolg: "Erster CSV-Import 🎉" 🎉',
      'success',
      5000
    );
  });

  it('shows toast when achievement transitions from locked to completed', () => {
    const initialAchievements: Achievement[] = [
      {
        id: '1',
        key: 'first_import',
        title: 'Erster CSV-Import 🎉',
        description: 'Test',
        type: 'import',
        status: 'locked',
        progress: 0,
      },
    ];

    const { rerender } = renderHook(
      ({ achievements }) => useNewlyCompletedAchievements(achievements),
      { initialProps: { achievements: initialAchievements } }
    );

    const completedAchievements: Achievement[] = [
      {
        id: '1',
        key: 'first_import',
        title: 'Erster CSV-Import 🎉',
        description: 'Test',
        type: 'import',
        status: 'completed',
        progress: 100,
        unlockedAt: new Date().toISOString(),
      },
    ];

    rerender({ achievements: completedAchievements });

    expect(mockToast).toHaveBeenCalledWith(
      'Neuer Erfolg: "Erster CSV-Import 🎉" 🎉',
      'success',
      5000
    );
  });

  it('does not show toast when achievement stays completed', () => {
    const achievements: Achievement[] = [
      {
        id: '1',
        key: 'first_import',
        title: 'Erster CSV-Import 🎉',
        description: 'Test',
        type: 'import',
        status: 'completed',
        progress: 100,
        unlockedAt: new Date().toISOString(),
      },
    ];

    const { rerender } = renderHook(
      ({ achievements }) => useNewlyCompletedAchievements(achievements),
      { initialProps: { achievements } }
    );

    // Rerender with same achievements
    rerender({ achievements });

    expect(mockToast).not.toHaveBeenCalled();
  });

  it('does not show toast when achievement progress increases but stays in_progress', () => {
    const initialAchievements: Achievement[] = [
      {
        id: '1',
        key: 'first_import',
        title: 'Erster CSV-Import 🎉',
        description: 'Test',
        type: 'import',
        status: 'in_progress',
        progress: 50,
      },
    ];

    const { rerender } = renderHook(
      ({ achievements }) => useNewlyCompletedAchievements(achievements),
      { initialProps: { achievements: initialAchievements } }
    );

    const updatedAchievements: Achievement[] = [
      {
        id: '1',
        key: 'first_import',
        title: 'Erster CSV-Import 🎉',
        description: 'Test',
        type: 'import',
        status: 'in_progress',
        progress: 80,
      },
    ];

    rerender({ achievements: updatedAchievements });

    expect(mockToast).not.toHaveBeenCalled();
  });
});

