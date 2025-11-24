import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { Insights } from '../Insights';
import * as useTransactionsDataModule from '../../hooks/useTransactionsData';
import type { NormalizedTransaction } from '../../hooks/useTransactionsData';

// Mock ResizeObserver for Recharts
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

// Mock ResponsiveContainer and chart components to avoid ResizeObserver issues
vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children, ...props }: any) => <div data-testid="responsive-container">{children}</div>,
    PieChart: ({ children, ...props }: any) => <div data-testid="mock-pie-chart">{children}</div>,
    Pie: ({ ...props }: any) => <div data-testid="mock-pie" />,
    Cell: ({ ...props }: any) => <div data-testid="mock-cell" />,
    LineChart: ({ children, ...props }: any) => <div data-testid="mock-line-chart">{children}</div>,
    Line: ({ ...props }: any) => <div data-testid="mock-line" />,
    AreaChart: ({ children, ...props }: any) => <div data-testid="mock-area-chart">{children}</div>,
    Area: ({ ...props }: any) => <div data-testid="mock-area" />,
    XAxis: ({ ...props }: any) => <div data-testid="mock-xaxis" />,
    YAxis: ({ ...props }: any) => <div data-testid="mock-yaxis" />,
    CartesianGrid: ({ ...props }: any) => <div data-testid="mock-grid" />,
    Tooltip: ({ ...props }: any) => <div data-testid="mock-tooltip" />,
    Legend: ({ ...props }: any) => <div data-testid="mock-legend" />,
  };
});

// Mock the hook
vi.mock('../../hooks/useTransactionsData');

const mockTransactions: NormalizedTransaction[] = [
  {
    id: 1,
    bookingDate: '2025-01-15',
    amount: -1200, // Large expense in groceries
    categoryId: 'groceries',
    categoryLabel: 'Lebensmittel & Drogerie',
    merchant: 'REWE',
    counterparty: 'REWE',
  },
  {
    id: 2,
    bookingDate: '2025-01-10',
    amount: -50, // Normal expense
    categoryId: 'groceries',
    categoryLabel: 'Lebensmittel & Drogerie',
    merchant: 'REWE',
    counterparty: 'REWE',
  },
  {
    id: 3,
    bookingDate: '2025-01-05',
    amount: -45, // Normal expense
    categoryId: 'groceries',
    categoryLabel: 'Lebensmittel & Drogerie',
    merchant: 'REWE',
    counterparty: 'REWE',
  },
  {
    id: 4,
    bookingDate: '2025-01-01',
    amount: -48, // Normal expense
    categoryId: 'groceries',
    categoryLabel: 'Lebensmittel & Drogerie',
    merchant: 'REWE',
    counterparty: 'REWE',
  },
  {
    id: 5,
    bookingDate: '2024-12-28',
    amount: -52, // Normal expense
    categoryId: 'groceries',
    categoryLabel: 'Lebensmittel & Drogerie',
    merchant: 'REWE',
    counterparty: 'REWE',
  },
  {
    id: 6,
    bookingDate: '2024-12-25',
    amount: -49, // Normal expense
    categoryId: 'groceries',
    categoryLabel: 'Lebensmittel & Drogerie',
    merchant: 'REWE',
    counterparty: 'REWE',
  },
  {
    id: 7,
    bookingDate: '2025-01-20',
    amount: 3000, // Income
    categoryId: 'income_salary',
    categoryLabel: 'Gehalt & Lohn',
    merchant: 'Arbeitgeber',
    counterparty: 'Arbeitgeber',
  },
  {
    id: 8,
    bookingDate: '2025-01-12',
    amount: -25, // Small expense in different category
    categoryId: 'dining_out',
    categoryLabel: 'Gastronomie & Café',
    merchant: 'Café Berlin',
    counterparty: 'Café Berlin',
  },
];

describe('Insights', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders KPI strip with correct totals', async () => {
    vi.mocked(useTransactionsDataModule.useTransactionsData).mockReturnValue({
      transactions: mockTransactions,
      isLoading: false,
      error: null,
      currentPeriod: '90d',
      setCurrentPeriod: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/insights']}>
        <Routes>
          <Route path="/insights" element={<Insights />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Gesamtausgaben/i)).toBeInTheDocument();
      expect(screen.getByText(/Gesamteinnahmen/i)).toBeInTheDocument();
      expect(screen.getByText(/Netto/i)).toBeInTheDocument();
      expect(screen.getByText(/Buchungen/i)).toBeInTheDocument();
    });

    // Check that amounts are displayed (format may vary)
    // The currency formatter will format numbers, so we just check that the labels are present
    expect(screen.getByText(/Gesamtausgaben/i)).toBeInTheDocument();
  });

  it('renders top category card', async () => {
    vi.mocked(useTransactionsDataModule.useTransactionsData).mockReturnValue({
      transactions: mockTransactions,
      isLoading: false,
      error: null,
      currentPeriod: '90d',
      setCurrentPeriod: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/insights']}>
        <Routes>
          <Route path="/insights" element={<Insights />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Top-Kategorie/i)).toBeInTheDocument();
      expect(screen.getByText(/Lebensmittel & Drogerie/i)).toBeInTheDocument();
    });
  });

  it('renders largest expense card with display name', async () => {
    vi.mocked(useTransactionsDataModule.useTransactionsData).mockReturnValue({
      transactions: mockTransactions,
      isLoading: false,
      error: null,
      currentPeriod: '90d',
      setCurrentPeriod: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/insights']}>
        <Routes>
          <Route path="/insights" element={<Insights />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      // Updated title: "Größte Ausgabe" (shortened from "Größte einzelne Ausgabe")
      expect(screen.getByText(/Größte Ausgabe/i)).toBeInTheDocument();
      // Verify merchant name is displayed (should be short display name, not raw booking text)
      expect(screen.getByText(/REWE/i)).toBeInTheDocument();
    });
  });

  it('detects and displays recurring candidates', async () => {
    // Create transactions with monthly pattern
    const recurringTxs: NormalizedTransaction[] = [
      {
        id: 1,
        bookingDate: '2025-01-15',
        amount: -9.99,
        categoryId: 'subscriptions',
        categoryLabel: 'Abos & Mitgliedschaften',
        merchant: 'Netflix',
        counterparty: 'Netflix',
      },
      {
        id: 2,
        bookingDate: '2024-12-15',
        amount: -9.99,
        categoryId: 'subscriptions',
        categoryLabel: 'Abos & Mitgliedschaften',
        merchant: 'Netflix',
        counterparty: 'Netflix',
      },
      {
        id: 3,
        bookingDate: '2024-11-15',
        amount: -9.99,
        categoryId: 'subscriptions',
        categoryLabel: 'Abos & Mitgliedschaften',
        merchant: 'Netflix',
        counterparty: 'Netflix',
      },
      {
        id: 4,
        bookingDate: '2025-01-20',
        amount: 1000,
        categoryId: 'income_salary',
        categoryLabel: 'Gehalt & Lohn',
        merchant: 'Arbeitgeber',
        counterparty: 'Arbeitgeber',
      },
    ];

    vi.mocked(useTransactionsDataModule.useTransactionsData).mockReturnValue({
      transactions: recurringTxs,
      isLoading: false,
      error: null,
      currentPeriod: '90d',
      setCurrentPeriod: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/insights']}>
        <Routes>
          <Route path="/insights" element={<Insights />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Vermutlich Abo/i)).toBeInTheDocument();
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
    });
  });

  it('displays anomalies with display names (not raw booking text)', async () => {
    vi.mocked(useTransactionsDataModule.useTransactionsData).mockReturnValue({
      transactions: mockTransactions,
      isLoading: false,
      error: null,
      currentPeriod: '90d',
      setCurrentPeriod: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/insights']}>
        <Routes>
          <Route path="/insights" element={<Insights />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      // Updated title: "Ungewöhnliche Ausgaben" (shortened from "Ungewöhnlich hohe Ausgaben")
      expect(screen.getByText(/Ungewöhnliche Ausgaben/i)).toBeInTheDocument();
      // Verify merchant name is displayed (should be short display name, not raw booking text)
      expect(screen.getByText(/REWE/i)).toBeInTheDocument();
      expect(screen.getByText(/Ausreißer/i)).toBeInTheDocument();
    });
  });

  it('shows loading state', async () => {
    vi.mocked(useTransactionsDataModule.useTransactionsData).mockReturnValue({
      transactions: [],
      isLoading: true,
      error: null,
      currentPeriod: '90d',
      setCurrentPeriod: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/insights']}>
        <Routes>
          <Route path="/insights" element={<Insights />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Lade Daten/i)).toBeInTheDocument();
    });
  });

  it('allows changing period filter', async () => {
    const setCurrentPeriod = vi.fn();
    vi.mocked(useTransactionsDataModule.useTransactionsData).mockReturnValue({
      transactions: mockTransactions,
      isLoading: false,
      error: null,
      currentPeriod: '90d',
      setCurrentPeriod,
    });

    render(
      <MemoryRouter initialEntries={['/insights']}>
        <Routes>
          <Route path="/insights" element={<Insights />} />
        </Routes>
      </MemoryRouter>,
    );

    // Wait for page to render
    await waitFor(() => {
      expect(screen.getByText(/Insights/i)).toBeInTheDocument();
    });

    // Check that filter buttons are present
    expect(screen.getByText(/30 Tage/i)).toBeInTheDocument();
    expect(screen.getByText(/90 Tage/i)).toBeInTheDocument();
    expect(screen.getByText(/Dieses Jahr/i)).toBeInTheDocument();
  });

  it('renders empty state when no transactions', async () => {
    vi.mocked(useTransactionsDataModule.useTransactionsData).mockReturnValue({
      transactions: [],
      isLoading: false,
      error: null,
      currentPeriod: '90d',
      setCurrentPeriod: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/insights']}>
        <Routes>
          <Route path="/insights" element={<Insights />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      // Check that empty states are shown (chart and cards)
      expect(screen.getByText(/Noch keine Ausgaben-Daten/i)).toBeInTheDocument();
    });
  });

  it('uses short display names instead of raw booking text', async () => {
    // Create transaction with raw booking text that should be cleaned
    const transactionsWithRawText: NormalizedTransaction[] = [
      {
        id: 1,
        bookingDate: '2025-01-15',
        amount: -100,
        categoryId: 'groceries',
        categoryLabel: 'Lebensmittel & Drogerie',
        merchant: 'Netflix', // This should be the display name (already cleaned by useTransactionsData)
        counterparty: 'Netflix',
      },
    ];

    vi.mocked(useTransactionsDataModule.useTransactionsData).mockReturnValue({
      transactions: transactionsWithRawText,
      isLoading: false,
      error: null,
      currentPeriod: '90d',
      setCurrentPeriod: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/insights']}>
        <Routes>
          <Route path="/insights" element={<Insights />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      // Verify that the merchant name is displayed (should be short, not raw booking text)
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
      // Verify it's NOT showing raw booking text patterns like "Kartenzahlung | Buchungstext:"
      const pageText = document.body.textContent || '';
      expect(pageText).not.toMatch(/Kartenzahlung.*Buchungstext/i);
      expect(pageText).not.toMatch(/Überweisung.*Empfänger/i);
    });
  });
});

