import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SonstigesCleanupPage from '../../pages/SonstigesCleanup';

function mockFetchSequence(responses: Array<any>) {
  (global as any).fetch = vi.fn()
    // first: summary
    .mockResolvedValueOnce({ ok: true, json: async () => responses[0] })
    // second: total expenses (categories summary)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
    // third: preview (loaded automatically for each group)
    .mockResolvedValueOnce({ ok: true, json: async () => responses[1] })
    // fourth: apply
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
}

describe('SonstigesCleanupPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders merchant groups with merchant name, count, and total', async () => {
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
    expect(screen.getByText(/3 Buchungen/)).toBeTruthy();
    // Preview is loaded automatically, should show sample transaction
    await waitFor(() => {
      expect(screen.getByText(/Latte/)).toBeTruthy();
    });
  });

  it('enables apply button when category is selected', async () => {
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
    
    // Button should be disabled until category is selected
    const applyButton = screen.getByText(/Übernehmen & weiter/);
    expect(applyButton).toBeDisabled();

    // Select a category by changing the CategoryControl select
    const categorySelect = screen.getByRole('combobox');
    fireEvent.change(categorySelect, { target: { value: 'groceries' } });
    
    // Wait for the category to be applied (CategoryControl calls onApplied)
    await waitFor(() => {
      // Button should now be enabled
      expect(applyButton).not.toBeDisabled();
    });
  });

  it('removes group from list on successful apply', async () => {
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
    
    // Select a category
    const categorySelect = screen.getByRole('combobox');
    fireEvent.change(categorySelect, { target: { value: 'groceries' } });
    
    await waitFor(() => {
      const applyButton = screen.getByText(/Übernehmen & weiter/);
      expect(applyButton).not.toBeDisabled();
      fireEvent.click(applyButton);
    });
    
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalledTimes(4)); // summary + expenses + preview + apply
    // Group should be removed from list
    await waitFor(() => {
      expect(screen.queryByText(/COFFEECO/)).toBeNull();
    });
  });

  it('handles 409 conflict gracefully', async () => {
    (global as any).fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ totalSonstigesCents: 10000, groups: [{ groupId: 'g', displayName: 'G', txCount: 1, totalExpenseCents: 10000, lastDate: '2025-11-10', exampleTransactionId: '1' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
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
    
    // Select a category
    const categorySelect = screen.getByRole('combobox');
    fireEvent.change(categorySelect, { target: { value: 'groceries' } });
    
    await waitFor(() => {
      const applyButton = screen.getByText(/Übernehmen & weiter/);
      expect(applyButton).not.toBeDisabled();
      fireEvent.click(applyButton);
    });
    
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalledTimes(4)); // summary + expenses + preview + apply
    // Conflict handled - group should still be present (not removed)
    expect(screen.getByText(/G/)).toBeTruthy();
  });
});
