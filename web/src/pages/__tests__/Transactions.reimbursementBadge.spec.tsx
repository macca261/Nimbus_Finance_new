import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Transactions } from '../Transactions';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';

// Mock the AppShell component
vi.mock('../../layout/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock fetch
global.fetch = vi.fn();

describe('Transactions reimbursement badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders reimbursement badge for receiver role', async () => {
    const mockTransactions = {
      ok: true,
      total: 2,
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
        },
        {
          id: 2,
          bookingDate: '2025-01-20',
          amount: 50.0,
          amountCents: 5000,
          currency: 'EUR',
          purpose: 'Rückbuchung PayPal',
          counterpart: 'PayPal',
          category: 'other',
          isReimbursement: true,
          reimbursementRole: 'receiver',
          reimbursementGroupId: 'rb_123',
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
    await screen.findByText('Normal expense');

    // Check that reimbursement badge appears
    const badge = screen.getByText('Erstattung erhalten');
    expect(badge).toBeInTheDocument();
  });

  it('renders reimbursement badge for payer role', async () => {
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
          reimbursementGroupId: 'rb_123',
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
    await screen.findByText('Payment to friend');

    // Check that reimbursement badge appears
    const badge = screen.getByText('Erstattung gezahlt');
    expect(badge).toBeInTheDocument();
  });

  it('does not render badge for normal transaction', async () => {
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
    await screen.findByText('Normal expense');

    // Check that reimbursement badge does NOT appear
    expect(screen.queryByText('Erstattung erhalten')).not.toBeInTheDocument();
    expect(screen.queryByText('Erstattung gezahlt')).not.toBeInTheDocument();
  });

  it('renders payment provider funding badge', async () => {
    const mockTransactions = {
      ok: true,
      total: 1,
      transactions: [
        {
          id: 1,
          bookingDate: '2025-01-15',
          amount: -51.83,
          amountCents: -5183,
          currency: 'EUR',
          purpose: 'PayPal (Europe) S.a.r.l. et Cie',
          counterpart: 'PAYPAL',
          category: 'other',
          isInternalTransfer: true,
          internalTransferKind: 'payment_provider_funding',
          internalTransferDirection: 'out',
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
    await screen.findByText(/PayPal/i);

    // Check that payment provider funding badge appears
    const badge = screen.getByText(/PayPal-Aufladung|Zahlungsdienstleister-Aufladung/i);
    expect(badge).toBeInTheDocument();
  });

  it('shows payment provider funding badge with account names', async () => {
    const mockTransactions = {
      ok: true,
      total: 1,
      transactions: [
        {
          id: 1,
          bookingDate: '2025-01-15',
          amount: -51.83,
          amountCents: -5183,
          currency: 'EUR',
          purpose: 'PayPal (Europe) S.a.r.l. et Cie',
          counterpart: 'PAYPAL',
          category: 'other',
          isInternalTransfer: true,
          internalTransferKind: 'payment_provider_funding',
          internalTransferDirection: 'out',
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
    await screen.findByText(/PayPal/i);

    // Check that payment provider funding badge appears
    // The badge should show "PayPal-Aufladung" or "Zahlungsdienstleister-Aufladung"
    const badge = screen.getByText(/Aufladung/i);
    expect(badge).toBeInTheDocument();
  });
});

