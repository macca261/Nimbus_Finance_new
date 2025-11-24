import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MonthlyIncomeExpenseChart } from '../MonthlyIncomeExpenseChart';
import { useMonthlyIncomeExpense } from '../../../lib/hooks/useMonthlyIncomeExpense';

// Mock the hook
vi.mock('../../../lib/hooks/useMonthlyIncomeExpense', () => ({
  useMonthlyIncomeExpense: vi.fn(),
}));

const mockUseMonthlyIncomeExpense = useMonthlyIncomeExpense as ReturnType<typeof vi.fn>;

describe('MonthlyIncomeExpenseChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    mockUseMonthlyIncomeExpense.mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
    });

    render(<MonthlyIncomeExpenseChart />);

    expect(screen.getByText('Lade Daten…')).toBeInTheDocument();
  });

  it('renders error state', () => {
    mockUseMonthlyIncomeExpense.mockReturnValue({
      data: [],
      isLoading: false,
      error: 'Failed to load data',
    });

    render(<MonthlyIncomeExpenseChart />);

    expect(screen.getByText('Failed to load data')).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    mockUseMonthlyIncomeExpense.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    render(<MonthlyIncomeExpenseChart />);

    expect(screen.getByText('Noch keine Daten vorhanden.')).toBeInTheDocument();
  });

  it('renders chart with data', async () => {
    const mockData = [
      { month: '2025-01', totalIncomeCents: 500000, totalExpenseCents: 300000 },
      { month: '2025-02', totalIncomeCents: 600000, totalExpenseCents: 350000 },
      { month: '2025-03', totalIncomeCents: 550000, totalExpenseCents: 400000 },
    ];

    mockUseMonthlyIncomeExpense.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    });

    render(<MonthlyIncomeExpenseChart />);

    // Check that the chart title is rendered
    expect(screen.getByText('Einnahmen vs. Ausgaben (letzte 6 Monate)')).toBeInTheDocument();
    expect(screen.getByText('Monatlicher Vergleich')).toBeInTheDocument();

    // Check that legend labels are rendered (these come from recharts)
    await waitFor(() => {
      // The chart should render, we can check for the presence of the chart container
      const chartContainer = document.querySelector('.recharts-wrapper');
      expect(chartContainer).toBeInTheDocument();
    });
  });

  it('renders without card wrapper when noCard is true', () => {
    mockUseMonthlyIncomeExpense.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    const { container } = render(<MonthlyIncomeExpenseChart noCard />);

    // Should not have the card wrapper classes
    const cardWrapper = container.querySelector('.rounded-2xl.border.bg-white');
    expect(cardWrapper).not.toBeInTheDocument();
  });

  it('hides header when noHeader is true', () => {
    mockUseMonthlyIncomeExpense.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    render(<MonthlyIncomeExpenseChart noHeader />);

    expect(screen.queryByText('Einnahmen vs. Ausgaben (letzte 6 Monate)')).not.toBeInTheDocument();
  });
});

