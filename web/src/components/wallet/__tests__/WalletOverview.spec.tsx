import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { WalletOverview } from '../WalletOverview';
import * as useAccountsOverviewModule from '../../../hooks/useAccountsOverview';
import type { AccountsOverview } from '../../../hooks/useAccountsOverview';

// Mock ResizeObserver for Recharts
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

// Mock ResponsiveContainer to avoid ResizeObserver issues
vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children, ...props }: any) => <div data-testid="responsive-container">{children}</div>,
  };
});

// Mock the hook
vi.mock('../../../hooks/useAccountsOverview');

const mockOverview: AccountsOverview = {
  accounts: [
    {
      id: 'acc-1',
      name: 'DKB Giro',
      bankName: 'DKB',
      type: 'checking',
      balance: 5000.0,
      currency: 'EUR',
      last30dDelta: 500.0,
      isPrimary: true,
    },
    {
      id: 'acc-2',
      name: 'ING Visa',
      bankName: 'ING',
      type: 'credit',
      balance: -200.0,
      currency: 'EUR',
      last30dDelta: -50.0,
      isPrimary: false,
    },
  ],
  totalBalance: 4800.0,
  totalDelta30d: 450.0,
  lastUpdated: new Date().toISOString(),
  upcomingPayments: [
    {
      id: 'payment-1',
      label: 'Netflix',
      date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
      amount: 9.99,
    },
  ],
};

describe('WalletOverview', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders total balance', async () => {
    vi.mocked(useAccountsOverviewModule.useAccountsOverview).mockReturnValue({
      data: mockOverview,
      isLoading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<WalletOverview />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Gesamtsaldo/i)).toBeInTheDocument();
      expect(screen.getByText(/4.800/i)).toBeInTheDocument(); // Balance should be displayed
    });
  });

  it('renders account cards with names', async () => {
    vi.mocked(useAccountsOverviewModule.useAccountsOverview).mockReturnValue({
      data: mockOverview,
      isLoading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<WalletOverview />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/DKB Giro/i)).toBeInTheDocument();
      expect(screen.getByText(/ING Visa/i)).toBeInTheDocument();
    });
  });

  it('renders upcoming payments', async () => {
    vi.mocked(useAccountsOverviewModule.useAccountsOverview).mockReturnValue({
      data: mockOverview,
      isLoading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<WalletOverview />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Demnächst fällig/i)).toBeInTheDocument();
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
    });
  });

  it('shows loading state', async () => {
    vi.mocked(useAccountsOverviewModule.useAccountsOverview).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<WalletOverview />} />
        </Routes>
      </MemoryRouter>,
    );

    // Should show skeleton loaders (check for animated pulse elements)
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no accounts', async () => {
    vi.mocked(useAccountsOverviewModule.useAccountsOverview).mockReturnValue({
      data: { accounts: [], totalBalance: 0, totalDelta30d: 0, lastUpdated: new Date().toISOString(), upcomingPayments: [] },
      isLoading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<WalletOverview />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Noch keine Konten vorhanden/i)).toBeInTheDocument();
    });
  });

  it('shows no upcoming payments message when empty', async () => {
    const overviewWithoutPayments: AccountsOverview = {
      ...mockOverview,
      upcomingPayments: [],
    };

    vi.mocked(useAccountsOverviewModule.useAccountsOverview).mockReturnValue({
      data: overviewWithoutPayments,
      isLoading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<WalletOverview />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Keine anstehenden Zahlungen/i)).toBeInTheDocument();
    });
  });

  it('renders without throwing when mock data is provided', async () => {
    vi.mocked(useAccountsOverviewModule.useAccountsOverview).mockReturnValue({
      data: mockOverview,
      isLoading: false,
      error: null,
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<WalletOverview />} />
        </Routes>
      </MemoryRouter>,
    );

    // Should render without errors
    expect(container).toBeTruthy();

    // Should display at least one account card
    await waitFor(() => {
      expect(screen.getByText(/DKB Giro/i)).toBeInTheDocument();
    });
  });
});

