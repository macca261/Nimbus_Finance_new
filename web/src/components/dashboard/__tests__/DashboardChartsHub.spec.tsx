import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardChartsHub } from '../DashboardChartsHub';
import type { DashboardSummary } from '../../../hooks/useDashboardData';
import type { MonthlyInsights } from '../../../lib/hooks/useMonthlyInsights';

// Mock the child components to simplify testing
vi.mock('../DashboardBalanceChart', () => ({
  DashboardBalanceChart: ({ loading }: { loading?: boolean }) => (
    <div data-testid="balance-chart">
      {loading ? 'Loading balance chart...' : 'Balance Chart Content'}
    </div>
  ),
}));

vi.mock('../CategoryDonutWithNavigation', () => ({
  CategoryDonutWithNavigation: ({ loading }: { loading?: boolean }) => (
    <div data-testid="category-chart">
      {loading ? 'Loading category chart...' : 'Category Chart Content'}
    </div>
  ),
}));

vi.mock('../MonthlySnapshotCard', () => ({
  MonthlySnapshotCard: () => <div data-testid="monthly-snapshot">Monthly Snapshot</div>,
}));

vi.mock('../MonthlyIncomeExpenseChart', () => ({
  MonthlyIncomeExpenseChart: () => (
    <div data-testid="income-expense-chart">Income vs Expense Chart</div>
  ),
}));

describe('DashboardChartsHub', () => {
  const mockBalance: DashboardSummary['balanceOverTime'] = [
    { date: '2024-01-01', balance: 1000 },
    { date: '2024-01-02', balance: 1100 },
  ];

  const mockCashflow: DashboardSummary['cashflowByMonth'] = [
    { month: '2024-01', income: 2000, expenses: 1500 },
  ];

  const mockCategorySlices = [
    { id: 'groceries', label: 'Lebensmittel', total: 500 },
    { id: 'transport', label: 'Transport', total: 300 },
  ];

  const mockInsights: MonthlyInsights = {
    transactionCount: 42,
    isLoading: false,
  };

  const defaultProps = {
    balance: mockBalance,
    cashflow: mockCashflow,
    categorySlices: mockCategorySlices,
    loading: false,
    dateRangeLabel: 'Letzte 30 Tage',
    onCategoryClick: vi.fn(),
    insights: mockInsights,
  };

  it('renders the hub with header and tabs', () => {
    render(<DashboardChartsHub {...defaultProps} />);

    expect(screen.getByText('Verlauf & Kategorien')).toBeInTheDocument();
    expect(screen.getByText('Wechsle zwischen Cashflow, Kategorien und Ein/Aus-Vergleich.')).toBeInTheDocument();
    expect(screen.getByText('Saldo & Cashflow')).toBeInTheDocument();
    expect(screen.getByText('Ausgaben nach Kategorie')).toBeInTheDocument();
    expect(screen.getByText('Ein/Aus (6 Monate)')).toBeInTheDocument();
  });

  it('shows balance chart by default', () => {
    render(<DashboardChartsHub {...defaultProps} />);

    expect(screen.getByTestId('balance-chart')).toBeInTheDocument();
    expect(screen.getByText('Balance Chart Content')).toBeInTheDocument();
    expect(screen.queryByTestId('category-chart')).not.toBeInTheDocument();
  });

  it('shows monthly snapshot card', () => {
    render(<DashboardChartsHub {...defaultProps} />);

    expect(screen.getByTestId('monthly-snapshot')).toBeInTheDocument();
  });

  it('switches to category chart when category tab is clicked', () => {
    render(<DashboardChartsHub {...defaultProps} />);

    // Initially shows balance chart
    expect(screen.getByTestId('balance-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('category-chart')).not.toBeInTheDocument();

    // Click category tab
    const categoryTab = screen.getByText('Ausgaben nach Kategorie');
    fireEvent.click(categoryTab);

    // Now shows category chart
    expect(screen.queryByTestId('balance-chart')).not.toBeInTheDocument();
    expect(screen.getByTestId('category-chart')).toBeInTheDocument();
  });

  it('switches back to balance chart when balance tab is clicked', () => {
    render(<DashboardChartsHub {...defaultProps} />);

    // Switch to category first
    const categoryTab = screen.getByText('Ausgaben nach Kategorie');
    fireEvent.click(categoryTab);
    expect(screen.getByTestId('category-chart')).toBeInTheDocument();

    // Switch back to balance
    const balanceTab = screen.getByText('Saldo & Cashflow');
    fireEvent.click(balanceTab);

    expect(screen.getByTestId('balance-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('category-chart')).not.toBeInTheDocument();
  });

  it('passes loading state to charts', () => {
    render(<DashboardChartsHub {...defaultProps} loading={true} />);

    expect(screen.getByText('Loading balance chart...')).toBeInTheDocument();
  });

  it('switches to income/expense chart when income/expense tab is clicked', () => {
    render(<DashboardChartsHub {...defaultProps} />);

    // Initially shows balance chart
    expect(screen.getByTestId('balance-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('income-expense-chart')).not.toBeInTheDocument();

    // Click income/expense tab
    const incomeExpenseTab = screen.getByText('Ein/Aus (6 Monate)');
    fireEvent.click(incomeExpenseTab);

    // Now shows income/expense chart
    expect(screen.queryByTestId('balance-chart')).not.toBeInTheDocument();
    expect(screen.getByTestId('income-expense-chart')).toBeInTheDocument();
  });
});

