/**
 * Tests for TransactionExplanationPanel Component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TransactionExplanationPanel } from '../components/TransactionExplanationPanel';
import * as transactionsApi from '../../../api/transactionsApi';

// Mock the hook
vi.mock('../../../hooks/useTransactionExplanation', () => ({
  useTransactionExplanation: vi.fn(),
}));

import { useTransactionExplanation } from '../../../hooks/useTransactionExplanation';

const mockUseTransactionExplanation = vi.mocked(useTransactionExplanation);

describe('TransactionExplanationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton', () => {
    mockUseTransactionExplanation.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<TransactionExplanationPanel transactionId={123} />);

    // Check for loading skeleton elements
    const skeleton = screen.getByRole('generic', { hidden: true });
    expect(skeleton).toBeInTheDocument();
  });

  it('shows error state on failure', () => {
    mockUseTransactionExplanation.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to fetch'),
      refetch: vi.fn(),
    });

    render(<TransactionExplanationPanel transactionId={123} />);

    expect(screen.getByText('Erklärung gerade nicht verfügbar')).toBeInTheDocument();
    expect(screen.getByText(/Die Kategorie bleibt gültig/)).toBeInTheDocument();
  });

  it('shows default "no trace" text when trace === null', () => {
    mockUseTransactionExplanation.mockReturnValue({
      data: {
        transactionId: 123,
        categoryId: 'groceries',
        displayName: 'REWE',
        amountCents: -5000,
        date: '2024-01-15',
        trace: null,
        aiSummary: null,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<TransactionExplanationPanel transactionId={123} />);

    expect(screen.getByText('Warum diese Kategorie?')).toBeInTheDocument();
    expect(screen.getByText(/Für diese Buchung liegt noch keine detaillierte Begründung vor/)).toBeInTheDocument();
  });

  it('renders method label and confidence properly for a mocked RULE trace', () => {
    mockUseTransactionExplanation.mockReturnValue({
      data: {
        transactionId: 123,
        categoryId: 'groceries',
        displayName: 'REWE',
        amountCents: -5000,
        date: '2024-01-15',
        trace: {
          method: 'RULE',
          confidence: 95,
          ruleMatchId: 'rewe-supermarket',
          ruleDescription: 'REWE Supermarkt erkannt',
          createdAt: '2024-01-15T10:00:00Z',
        },
        aiSummary: null,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<TransactionExplanationPanel transactionId={123} />);

    expect(screen.getByText('Warum diese Kategorie?')).toBeInTheDocument();
    expect(screen.getByText('Regelbasierte Zuordnung')).toBeInTheDocument();
    expect(screen.getByText(/REWE Supermarkt erkannt/)).toBeInTheDocument();
    expect(screen.getByText(/Vertrauen: 95%/)).toBeInTheDocument();
  });

  it('renders method label and confidence properly for a mocked LLM trace', () => {
    mockUseTransactionExplanation.mockReturnValue({
      data: {
        transactionId: 123,
        categoryId: 'groceries',
        displayName: 'REWE',
        amountCents: -5000,
        date: '2024-01-15',
        trace: {
          method: 'LLM',
          confidence: 88,
          llmModel: 'gpt-4o-mini',
          llmReasoning: 'Kategorie "Lebensmittel", weil der Händler REWE und ähnliche Einkäufe in deinen Daten fast immer dieser Kategorie entsprechen.',
          createdAt: '2024-01-15T10:00:00Z',
        },
        aiSummary: 'Kategorie "Lebensmittel", weil der Händler REWE und ähnliche Einkäufe in deinen Daten fast immer dieser Kategorie entsprechen.',
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<TransactionExplanationPanel transactionId={123} />);

    expect(screen.getByText('Warum diese Kategorie?')).toBeInTheDocument();
    expect(screen.getByText('Nimbus KI')).toBeInTheDocument();
    expect(screen.getByText(/Kategorie "Lebensmittel"/)).toBeInTheDocument();
    expect(screen.getByText(/Vertrauen: 88%/)).toBeInTheDocument();
  });

  it('returns null when transactionId is null', () => {
    const { container } = render(<TransactionExplanationPanel transactionId={null} />);
    expect(container.firstChild).toBeNull();
  });
});

