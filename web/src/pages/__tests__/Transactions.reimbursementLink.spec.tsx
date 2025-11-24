import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Transactions } from '../Transactions';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';

// Mock the AppShell component
vi.mock('../../layout/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock fetch
global.fetch = vi.fn();

describe('Transactions reimbursement link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('renders "Abrechnung öffnen" button for transaction with reimbursementGroupId', async () => {
    const mockTransactions = {
      ok: true,
      total: 1,
      transactions: [
        {
          id: 1,
          bookingDate: '2025-01-15',
          amount: -50.0,
          amountCents: -5000,
          currency: 'EUR',
          purpose: 'Payment to friend',
          counterpart: 'Friend Name',
          category: 'other',
          isReimbursement: true,
          reimbursementRole: 'payer',
          reimbursementGroupId: 'group_abc',
        },
      ],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTransactions,
    });

    render(
      <BrowserRouter>
        <Transactions />
      </BrowserRouter>,
    );

    // Wait for transactions to load
    await waitFor(() => {
      expect(screen.getByText('Payment to friend')).toBeInTheDocument();
    });

    // Check that "Abrechnung öffnen" button appears
    const button = screen.getByText('Abrechnung öffnen');
    expect(button).toBeInTheDocument();
  });

  it('navigates to review page with focusReimbursementGroup param when button is clicked', async () => {
    const mockTransactions = {
      ok: true,
      total: 1,
      transactions: [
        {
          id: 1,
          bookingDate: '2025-01-15',
          amount: -50.0,
          amountCents: -5000,
          currency: 'EUR',
          purpose: 'Payment to friend',
          counterpart: 'Friend Name',
          category: 'other',
          isReimbursement: true,
          reimbursementRole: 'payer',
          reimbursementGroupId: 'group_abc',
        },
      ],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTransactions,
    });

    render(
      <BrowserRouter>
        <Transactions />
      </BrowserRouter>,
    );

    // Wait for transactions to load
    await waitFor(() => {
      expect(screen.getByText('Payment to friend')).toBeInTheDocument();
    });

    // Click the button
    const button = screen.getByText('Abrechnung öffnen');
    fireEvent.click(button);

    // Check that navigate was called with correct path
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/review?focusReimbursementGroup=group_abc');
    });
  });

  it('does not render button for transaction without reimbursementGroupId', async () => {
    const mockTransactions = {
      ok: true,
      total: 1,
      transactions: [
        {
          id: 1,
          bookingDate: '2025-01-15',
          amount: -50.0,
          amountCents: -5000,
          currency: 'EUR',
          purpose: 'Normal expense',
          counterpart: 'Merchant',
          category: 'groceries',
          isReimbursement: false,
          reimbursementRole: null,
          reimbursementGroupId: null,
        },
      ],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTransactions,
    });

    render(
      <BrowserRouter>
        <Transactions />
      </BrowserRouter>,
    );

    // Wait for transactions to load
    await waitFor(() => {
      expect(screen.getByText('Normal expense')).toBeInTheDocument();
    });

    // Check that "Abrechnung öffnen" button does NOT appear
    expect(screen.queryByText('Abrechnung öffnen')).not.toBeInTheDocument();
  });
});

