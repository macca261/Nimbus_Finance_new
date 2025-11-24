import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { GoalsOverviewPage } from '../components/GoalsOverviewPage';
import * as useGoalsModule from '../../../hooks/useGoals';
import type { GoalProgress } from '../../../types/goals';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

// Mock the hook
vi.mock('../../../hooks/useGoals');

const mockGoalProgress: GoalProgress = {
  goal: {
    id: 'goal-1',
    name: 'Notgroschen',
    type: 'savings',
    targetCents: 100000, // 1000 EUR
    currentCents: 50000, // 500 EUR
    targetDate: '2025-12-31T00:00:00Z',
    currency: 'EUR',
    linkedAccountIds: null,
    linkedCategoryIds: null,
    description: 'Für unerwartete Ausgaben',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  currentCents: 50000,
  targetCents: 100000,
  progressPercent: 50,
  remainingCents: 50000,
  requiredMonthlyCents: 8333,
  projectedCompletionDate: '2025-12-31T00:00:00Z',
  status: 'on_track',
};

describe('GoalsOverviewPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders goals when data is available', async () => {
    vi.mocked(useGoalsModule.useGoals).mockReturnValue({
      goals: [mockGoalProgress],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/goals']}>
        <Routes>
          <Route path="/goals" element={<GoalsOverviewPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Ziele/i)).toBeInTheDocument();
      expect(screen.getByText(/Notgroschen/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no goals', async () => {
    vi.mocked(useGoalsModule.useGoals).mockReturnValue({
      goals: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/goals']}>
        <Routes>
          <Route path="/goals" element={<GoalsOverviewPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Noch keine Ziele vorhanden/i)).toBeInTheDocument();
    });
  });

  it('shows loading state', async () => {
    vi.mocked(useGoalsModule.useGoals).mockReturnValue({
      goals: [],
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/goals']}>
        <Routes>
          <Route path="/goals" element={<GoalsOverviewPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Should show skeleton loaders
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

