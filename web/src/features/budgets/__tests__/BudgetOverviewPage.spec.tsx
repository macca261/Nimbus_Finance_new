import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { BudgetOverviewPage } from '../components/BudgetOverviewPage';
import * as useBudgetsModule from '../../../hooks/useBudgets';
import type { BudgetSummary } from '../../../types/budgets';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

// Mock the hook
vi.mock('../../../hooks/useBudgets');

const mockBudgetSummary: BudgetSummary = {
  budget: {
    id: 'budget-1',
    name: 'Januar 2025',
    period: 'monthly',
    periodValue: '2025-01',
    currency: 'EUR',
    rolloverEnabled: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  allocations: [
    {
      id: 'alloc-1',
      budgetId: 'budget-1',
      categoryId: 'groceries',
      plannedCents: 50000,
      rolloverFromPrevious: false,
      spentCents: 30000,
      remainingCents: 20000,
      progressPercent: 60,
      isOverspent: false,
    },
  ],
  totalPlannedCents: 50000,
  totalSpentCents: 30000,
  totalRemainingCents: 20000,
  overspendCount: 0,
};

describe('BudgetOverviewPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders budget summary when data is available', async () => {
    vi.mocked(useBudgetsModule.useBudgets).mockReturnValue({
      budgets: [mockBudgetSummary],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/budgets']}>
        <Routes>
          <Route path="/budgets" element={<BudgetOverviewPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Budgets/i)).toBeInTheDocument();
      expect(screen.getByText(/Januar 2025/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no budgets', async () => {
    vi.mocked(useBudgetsModule.useBudgets).mockReturnValue({
      budgets: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/budgets']}>
        <Routes>
          <Route path="/budgets" element={<BudgetOverviewPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Noch keine Budgets vorhanden/i)).toBeInTheDocument();
    });
  });

  it('shows loading state', async () => {
    vi.mocked(useBudgetsModule.useBudgets).mockReturnValue({
      budgets: [],
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/budgets']}>
        <Routes>
          <Route path="/budgets" element={<BudgetOverviewPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Lade Budgets/i)).toBeInTheDocument();
    });
  });

  it('displays error message when error occurs', async () => {
    vi.mocked(useBudgetsModule.useBudgets).mockReturnValue({
      budgets: [],
      isLoading: false,
      error: 'Fehler beim Laden',
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/budgets']}>
        <Routes>
          <Route path="/budgets" element={<BudgetOverviewPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Fehler beim Laden/i)).toBeInTheDocument();
    });
  });
});

