import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { Transactions } from '../../pages/Transactions';

function mockFetchOnce(data: any) {
  (global as any).fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => data,
  });
}

describe('Transactions query params integration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('applies uncategorized review filter from URL on mount', async () => {
    const txs = [
      { id: 1, bookingDate: '2025-11-01', amount: -10, currency: 'EUR', category: 'other', categoryConfidence: 0.9 },
      { id: 2, bookingDate: '2025-11-02', amount: -20, currency: 'EUR', category: 'groceries', categoryConfidence: 0.9 },
      { id: 3, bookingDate: '2025-11-03', amount: -30, currency: 'EUR', category: 'other_review', categoryConfidence: 0.2 },
    ];
    mockFetchOnce({ ok: true, total: txs.length, transactions: txs });

    render(
      <MemoryRouter initialEntries={['/transactions?review=uncategorized']}>
        <Routes>
          <Route path="/transactions" element={<Transactions />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect((global as any).fetch).toHaveBeenCalled());
    // Should only show the two "other" rows. Spot check that "Keine Transaktionen" is not shown.
    expect(screen.queryByText('Keine Transaktionen gefunden.')).toBeNull();
  });

  it('applies low-confidence review filter from URL on mount', async () => {
    const txs = [
      { id: 1, bookingDate: '2025-11-01', amount: -10, currency: 'EUR', category: 'groceries', categoryConfidence: 0.9 },
      { id: 2, bookingDate: '2025-11-02', amount: -20, currency: 'EUR', category: 'shopping', categoryConfidence: 0.3 },
      { id: 3, bookingDate: '2025-11-03', amount: -30, currency: 'EUR', category: 'other_review', categoryConfidence: 0.2 },
    ];
    mockFetchOnce({ ok: true, total: txs.length, transactions: txs });

    render(
      <MemoryRouter initialEntries={['/transactions?review=low-confidence']}>
        <Routes>
          <Route path="/transactions" element={<Transactions />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect((global as any).fetch).toHaveBeenCalled());
    // Low-confidence banner appears
    expect(
      screen.getByText(/Niedrige Confidence/i),
    ).toBeTruthy();
  });

  it('preselects category from URL if provided', async () => {
    const txs = [
      { id: 1, bookingDate: '2025-11-01', amount: -10, currency: 'EUR', category: 'groceries', categoryConfidence: 0.9 },
      { id: 2, bookingDate: '2025-11-02', amount: -20, currency: 'EUR', category: 'shopping', categoryConfidence: 0.8 },
    ];
    mockFetchOnce({ ok: true, total: txs.length, transactions: txs });

    render(
      <MemoryRouter initialEntries={['/transactions?category=groceries']}>
        <Routes>
          <Route path="/transactions" element={<Transactions />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect((global as any).fetch).toHaveBeenCalled());
    // The filter select should have 'groceries' selected (visible as default option label present)
    expect(screen.getByDisplayValue('groceries')).toBeTruthy();
  });
});


