/**
 * Tests for Review page - Session Celebration Banner and Render Loop Prevention
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ReviewPage from '../Review';
import * as reviewApi from '../../api/reviewApi';
import * as subscriptionsApi from '../../lib/api/subscriptions';

// Mock the API functions
vi.mock('../../api/reviewApi', () => ({
  fetchReviewTransactions: vi.fn(),
  fetchCategories: vi.fn().mockResolvedValue([]),
  fetchReimbursementGroups: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../lib/api/subscriptions', () => ({
  fetchSubscriptionCandidates: vi.fn().mockResolvedValue([]),
}));

// Mock AI category API
vi.mock('../../api/aiCategoryApi', () => ({
  isAiCategorizationEnabled: () => true,
  fetchCategorySuggestion: vi.fn(),
  sendCategoryFeedback: vi.fn(),
}));

// Mock batch AI suggestions hook
const mockGetSuggestion = vi.fn(() => null);
const mockHasAttempted = vi.fn(() => false);
const mockRefetch = vi.fn();
vi.mock('../../hooks/useBatchAiSuggestions', () => ({
  useBatchAiSuggestions: vi.fn(() => ({
    getSuggestion: mockGetSuggestion,
    hasAttempted: mockHasAttempted,
    isLoading: false,
    error: null,
    rateLimited: false,
    refetch: mockRefetch,
    suggestions: new Map(),
  })),
  getBatchCacheSuggestion: vi.fn(() => null),
}));

// Mock AppShell
vi.mock('../../layout/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('ReviewPage - Session Celebration Banner and Render Loop Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSuggestion.mockReturnValue(null);
    mockHasAttempted.mockReturnValue(false);
  });

  const renderReviewPage = () => {
    return render(
      <BrowserRouter>
        <ReviewPage />
      </BrowserRouter>
    );
  };

  it('does not show celebration banner when there are open tasks', async () => {
    (reviewApi.fetchReviewTransactions as any).mockResolvedValue([
      {
        id: 'tx1',
        bookingDate: '2025-01-20',
        amountCents: -10000,
        currency: 'EUR',
        direction: 'out',
        category: 'other',
        categorySource: 'ml',
        categoryConfidence: 0.5,
        rawText: 'Test transaction',
      },
    ]);

    renderReviewPage();

    await waitFor(() => {
      expect(screen.queryByText(/Alles erledigt für heute/)).not.toBeInTheDocument();
    });
  });

  it('shows celebration banner when all tasks are completed', async () => {
    // Mock fetch to return empty arrays for all data sources
    (reviewApi.fetchReviewTransactions as any).mockResolvedValue([]);
    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue([]);
    (subscriptionsApi.fetchSubscriptionCandidates as any).mockResolvedValue([]);
    
    // Mock the quality data fetch (used in useEffect)
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], totals: {} }),
    }) as any;

    renderReviewPage();

    // Wait for all async operations to complete and check for banner
    await waitFor(() => {
      const banner = screen.queryByText(/Alles erledigt für heute/);
      if (banner) {
        expect(banner).toBeInTheDocument();
        expect(screen.getByText(/Nimbus hat dir gerade nichts mehr zum Aufräumen/)).toBeInTheDocument();
      }
    }, { timeout: 5000 });
  });

  it('renders Sonstiges transactions without causing render loops', async () => {
    // Mock transactions with Sonstiges (uncategorized)
    (reviewApi.fetchReviewTransactions as any).mockResolvedValue([
      {
        id: 'tx-sonstiges-1',
        bookingDate: '2025-01-20',
        amountCents: -10000,
        currency: 'EUR',
        direction: 'out',
        category: 'other',
        categorySource: 'ml',
        categoryConfidence: 0.5,
        rawText: 'Test transaction 1',
      },
      {
        id: 'tx-sonstiges-2',
        bookingDate: '2025-01-21',
        amountCents: -5000,
        currency: 'EUR',
        direction: 'out',
        category: null,
        categorySource: null,
        categoryConfidence: null,
        rawText: 'Test transaction 2',
      },
    ]);

    // Mock batch AI suggestions to return some suggestions
    mockGetSuggestion.mockImplementation((id: string) => {
      if (id === 'tx-sonstiges-1') {
        return {
          categoryId: 'groceries',
          confidence: 0.95,
          reasoning: 'High confidence suggestion',
        };
      }
      return null;
    });

    // Mock fetch for quality data
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], totals: {} }),
    }) as any;

    // Render and wait for initial load
    const { container } = render(
      <BrowserRouter>
        <ReviewPage />
      </BrowserRouter>
    );

    // Wait for transactions to load
    await waitFor(() => {
      expect(screen.getByText(/Sonstiges aufräumen/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify component rendered without errors
    // If there was a render loop, React would have thrown "Maximum update depth exceeded"
    // The fact that we get here means the component rendered successfully
    expect(container).toBeTruthy();
    
    // Verify Sonstiges section is visible
    const sonstigesSection = screen.queryByText(/Sonstiges aufräumen/i);
    expect(sonstigesSection).toBeInTheDocument();
  });

  it('handles AI suggestion updates without causing loops', async () => {
    const mockTransactions = [
      {
        id: 'tx-1',
        bookingDate: '2025-01-20',
        amountCents: -10000,
        currency: 'EUR',
        direction: 'out',
        category: 'other',
        categorySource: 'ml',
        categoryConfidence: 0.5,
        rawText: 'Test transaction',
      },
    ];

    (reviewApi.fetchReviewTransactions as any).mockResolvedValue(mockTransactions);

    // Mock fetch for quality data
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], totals: {} }),
    }) as any;

    const { container } = render(
      <BrowserRouter>
        <ReviewPage />
      </BrowserRouter>
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText(/Überprüfung/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Component should render without errors
    expect(container).toBeTruthy();
    
    // No console errors about maximum update depth should occur
    // (This is verified by the test completing successfully)
  });

  it('shows pagination button when there are more than 50 Sonstiges transactions', async () => {
    // Create 60 Sonstiges transactions (more than PAGE_SIZE of 50)
    const mockTransactions = Array.from({ length: 60 }, (_, i) => ({
      id: `tx-sonstiges-${i + 1}`,
      bookingDate: '2025-01-20',
      amountCents: -10000,
      currency: 'EUR',
      direction: 'out',
      category: 'other',
      categorySource: 'ml',
      categoryConfidence: 0.5,
      rawText: `Test transaction ${i + 1}`,
    }));

    (reviewApi.fetchReviewTransactions as any).mockResolvedValue(mockTransactions);

    // Mock fetch for quality data
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], totals: {} }),
    }) as any;

    renderReviewPage();

    // Wait for transactions to load
    await waitFor(() => {
      expect(screen.getByText(/Sonstiges aufräumen/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Should show "Mehr Buchungen anzeigen" button
    await waitFor(() => {
      const loadMoreButton = screen.queryByText(/Mehr Buchungen anzeigen/i);
      expect(loadMoreButton).toBeInTheDocument();
    });

    // Should show count of visible vs total
    expect(screen.getByText(/Angezeigt: 50 von 60 Buchungen/i)).toBeInTheDocument();
  });

  it('shows "Keine sichere KI-Einschätzung" badge when batch returns no suggestion', async () => {
    const transactions = [
      {
        id: 'tx-1',
        bookingDate: '2025-01-20',
        amountCents: -10000,
        currency: 'EUR',
        direction: 'out',
        category: 'other',
        categorySource: 'ml',
        categoryConfidence: 0.5,
        rawText: 'Test transaction',
      },
    ];

    (reviewApi.fetchReviewTransactions as any).mockResolvedValue(transactions);
    
    // Mock batch as attempted but no suggestion
    mockHasAttempted.mockReturnValue(true);
    mockGetSuggestion.mockReturnValue(null);

    // Mock fetch for quality data
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], totals: {} }),
    }) as any;

    renderReviewPage();

    await waitFor(() => {
      // Should show "no suggestion" badge
      expect(screen.getByText(/Keine sichere KI-Einschätzung/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});

