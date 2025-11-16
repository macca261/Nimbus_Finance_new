import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SonstigesCleanupPage from '../../pages/SonstigesCleanup';

function mockFetchSequence(responses: Array<any>) {
  (global as any).fetch = vi.fn()
    // first: summary
    .mockResolvedValueOnce({ ok: true, json: async () => responses[0] })
    // second: preview
    .mockResolvedValueOnce({ ok: true, json: async () => responses[1] })
    // third: apply
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
}

describe('SonstigesCleanupPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('loads preview on Details anzeigen and shows transactions', async () => {
    const summary = { totalSonstigesCents: 10000, groups: [{ groupId: 'coffee', displayName: 'COFFEECO', txCount: 3, totalExpenseCents: 10000, lastDate: '2025-11-10', exampleTransactionId: '1' }] };
    const preview = { transactions: [{ id: '1', bookingDate: '2025-11-09', amountCents: 500, description: 'Latte', currentCategoryId: 'other', categorySource: 'unknown' }], totalCount: 3, totalExpenseCents: 10000 };
    mockFetchSequence([summary, preview]);

    render(
      <MemoryRouter initialEntries={['/review/sonstiges']}>
        <Routes>
          <Route path="/review/sonstiges" element={<SonstigesCleanupPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect((global as any).fetch).toHaveBeenCalled());
    expect(screen.getByText(/COFFEECO/)).toBeTruthy();

    fireEvent.click(screen.getByText(/Details anzeigen/));
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/Latte/)).toBeTruthy();
  });

  it('shows confirmation and applies changes', async () => {
    const summary = { totalSonstigesCents: 10000, groups: [{ groupId: 'coffee', displayName: 'COFFEECO', txCount: 3, totalExpenseCents: 10000, lastDate: '2025-11-10', exampleTransactionId: '1' }] };
    const preview = { transactions: [], totalCount: 3, totalExpenseCents: 10000 };
    mockFetchSequence([summary, preview]);

    render(
      <MemoryRouter initialEntries={['/review/sonstiges']}>
        <Routes>
          <Route path="/review/sonstiges" element={<SonstigesCleanupPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect((global as any).fetch).toHaveBeenCalled());
    // Choose a category by simulating CategoryControl onApplied callback is complex; skip to clicking Übernehmen to open dialog
    fireEvent.click(screen.getByText('Übernehmen'));
    // Dialog appears; confirm
    await waitFor(() => {
      expect(screen.getByText(/Kategorie übernehmen/)).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Bestätigen'));
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalledTimes(3));
  });

  it('handles 409 conflict gracefully', async () => {
    (global as any).fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ totalSonstigesCents: 10000, groups: [{ groupId: 'g', displayName: 'G', txCount: 1, totalExpenseCents: 10000, lastDate: '2025-11-10', exampleTransactionId: '1' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ transactions: [], totalCount: 1, totalExpenseCents: 10000 }) })
      .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'rule_conflict', message: 'Es existiert bereits eine Regel für diesen Händler.' }) });

    render(
      <MemoryRouter initialEntries={['/review/sonstiges']}>
        <Routes>
          <Route path="/review/sonstiges" element={<SonstigesCleanupPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect((global as any).fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Übernehmen'));
    await waitFor(() => {
      expect(screen.getByText(/Kategorie übernehmen/)).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Bestätigen'));
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalledTimes(3));
    // Conflict handled (we can't check toast easily here; ensure row still present)
    expect(screen.getByText('Übernehmen')).toBeTruthy();
  });
});


