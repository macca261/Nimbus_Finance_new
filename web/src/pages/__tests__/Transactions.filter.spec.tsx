import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Transactions } from '../../pages/Transactions';

function mockFetchOnce(data: any) {
  (global as any).fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => data,
  });
}

describe('Transactions filter - Sonstiges exclusion', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('excludes cash withdrawals from "Nur Sonstiges anzeigen" filter', async () => {
    const user = userEvent.setup();
    
    // Mock transactions: one Sonstiges, one cash withdrawal
    const txs = [
      {
        id: 1,
        bookingDate: '2025-09-26',
        amount: -50,
        currency: 'EUR',
        category: 'other',
        purpose: 'UNKNOWN SHOP XYZ',
        counterpart: 'UNKNOWN SHOP',
        isCashWithdrawal: false,
        payee: null,
        memo: null,
        externalId: null,
        source: null,
        sourceProfile: null,
      },
      {
        id: 2,
        bookingDate: '2025-09-27',
        amount: -100,
        currency: 'EUR',
        category: 'cash_withdrawal', // Should be overridden by backend
        purpose: 'Auszahlung GAA | Auftraggeber: DEUTSCHE BANK Buchungstext: Bargeldauszahlung',
        counterpart: 'DEUTSCHE BANK',
        isCashWithdrawal: true,
        payee: null,
        memo: null,
        externalId: null,
        source: null,
        sourceProfile: null,
      },
    ];
    mockFetchOnce({ ok: true, total: txs.length, transactions: txs });

    render(
      <MemoryRouter initialEntries={['/transactions']}>
        <Routes>
          <Route path="/transactions" element={<Transactions />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect((global as any).fetch).toHaveBeenCalled());
    
    // Initially both should be visible
    await waitFor(() => {
      expect(screen.getByText(/UNKNOWN SHOP/i)).toBeInTheDocument();
    });
    
    // Enable "Nur Sonstiges anzeigen" filter
    const checkbox = screen.getByLabelText(/Nur 'Sonstiges' anzeigen/i);
    await user.click(checkbox);
    
    // Wait for filter to apply
    await waitFor(() => {
      // Only the Sonstiges row should be visible
      expect(screen.getByText(/UNKNOWN SHOP/i)).toBeInTheDocument();
      // Cash withdrawal should NOT be visible
      expect(screen.queryByText(/DEUTSCHE BANK/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Bargeldauszahlung/i)).not.toBeInTheDocument();
    });
  });

  it('excludes internal transfers from "Nur Sonstiges anzeigen" filter', async () => {
    const user = userEvent.setup();
    
    const txs = [
      {
        id: 1,
        bookingDate: '2025-09-26',
        amount: -50,
        currency: 'EUR',
        category: 'other',
        purpose: 'UNKNOWN MERCHANT',
        counterpart: 'UNKNOWN',
        isCashWithdrawal: false,
        isInternalTransfer: false,
        payee: null,
        memo: null,
        externalId: null,
        source: null,
        sourceProfile: null,
      },
      {
        id: 2,
        bookingDate: '2025-09-27',
        amount: -1000,
        currency: 'EUR',
        category: 'transfer_internal',
        purpose: 'Übertrag an Tagesgeld',
        counterpart: 'Self',
        isCashWithdrawal: false,
        isInternalTransfer: true,
        payee: null,
        memo: null,
        externalId: null,
        source: null,
        sourceProfile: null,
      },
    ];
    mockFetchOnce({ ok: true, total: txs.length, transactions: txs });

    render(
      <MemoryRouter initialEntries={['/transactions']}>
        <Routes>
          <Route path="/transactions" element={<Transactions />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect((global as any).fetch).toHaveBeenCalled());
    
    // Wait for initial transactions to render
    await waitFor(() => {
      expect(screen.getByText(/UNKNOWN MERCHANT/i)).toBeInTheDocument();
      expect(screen.getByText(/Tagesgeld/i)).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Enable "Nur Sonstiges anzeigen" filter
    const checkbox = screen.getByLabelText(/Nur 'Sonstiges' anzeigen/i);
    await user.click(checkbox);
    
    // Wait for filter to apply - transactions should re-render
    await waitFor(() => {
      // Only the Sonstiges transaction should be visible
      expect(screen.getByText(/UNKNOWN MERCHANT/i)).toBeInTheDocument();
      // Internal transfer should NOT be visible
      expect(screen.queryByText(/Tagesgeld/i)).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });
});

