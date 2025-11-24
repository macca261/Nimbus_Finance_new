/**
 * Tests for AiCleanupSummaryBar component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AiCleanupSummaryBar } from '../AiCleanupSummaryBar';
import type { AiSuggestionData } from '../SonstigesTransactionRow';

describe('AiCleanupSummaryBar', () => {
  const mockOnBatchAccept = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createSuggestionData = (
    transactionId: string,
    confidence: number,
    hasFetched = true
  ): AiSuggestionData => ({
    transactionId,
    suggestion: {
      categoryId: 'groceries',
      confidence,
      reasoning: 'Test reasoning',
    },
    isLoading: false,
    hasFetched,
  });

  it('renders nothing when there are no suggestions', () => {
    const { container } = render(
      <AiCleanupSummaryBar
        suggestionData={new Map()}
        totalTransactions={5}
        onBatchAccept={mockOnBatchAccept}
        isProcessing={false}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('shows summary with suggestion count', () => {
    const suggestionData = new Map([
      ['tx1', createSuggestionData('tx1', 0.95)],
      ['tx2', createSuggestionData('tx2', 0.85)],
    ]);

    render(
      <AiCleanupSummaryBar
        suggestionData={suggestionData}
        totalTransactions={5}
        onBatchAccept={mockOnBatchAccept}
        isProcessing={false}
      />
    );

    expect(screen.getByText(/KI-Vorschläge: 2 von 5 Buchungen/)).toBeInTheDocument();
    expect(screen.getByText(/Hohe Trefferquote zuerst aufräumen/)).toBeInTheDocument();
  });

  it('shows confidence buckets correctly', () => {
    const suggestionData = new Map([
      ['tx1', createSuggestionData('tx1', 0.95)], // High
      ['tx2', createSuggestionData('tx2', 0.92)], // High
      ['tx3', createSuggestionData('tx3', 0.80)], // Medium
      ['tx4', createSuggestionData('tx4', 0.50)], // Low
    ]);

    render(
      <AiCleanupSummaryBar
        suggestionData={suggestionData}
        totalTransactions={4}
        onBatchAccept={mockOnBatchAccept}
        isProcessing={false}
      />
    );

    expect(screen.getByText(/Hoch \(≥90%\): 2/)).toBeInTheDocument();
    expect(screen.getByText(/Mittel \(75–89%\): 1/)).toBeInTheDocument();
    expect(screen.getByText(/Niedrig \(<75%\): 1/)).toBeInTheDocument();
  });

  it('shows batch accept button when there are high-confidence suggestions', () => {
    const suggestionData = new Map([
      ['tx1', createSuggestionData('tx1', 0.95)],
      ['tx2', createSuggestionData('tx2', 0.92)],
    ]);

    render(
      <AiCleanupSummaryBar
        suggestionData={suggestionData}
        totalTransactions={2}
        onBatchAccept={mockOnBatchAccept}
        isProcessing={false}
      />
    );

    const button = screen.getByText(/Alle mit ≥ 90 % übernehmen \(2\)/) as HTMLButtonElement;
    expect(button).toBeInTheDocument();
    expect(button.disabled).toBe(false);
  });

  it('does not show batch accept button when there are no high-confidence suggestions', () => {
    const suggestionData = new Map([
      ['tx1', createSuggestionData('tx1', 0.80)], // Medium
      ['tx2', createSuggestionData('tx2', 0.50)], // Low
    ]);

    render(
      <AiCleanupSummaryBar
        suggestionData={suggestionData}
        totalTransactions={2}
        onBatchAccept={mockOnBatchAccept}
        isProcessing={false}
      />
    );

    expect(screen.queryByText(/Alle mit ≥ 90 % übernehmen/)).not.toBeInTheDocument();
  });

  it('calls onBatchAccept when batch button is clicked', () => {
    const suggestionData = new Map([
      ['tx1', createSuggestionData('tx1', 0.95)],
    ]);

    render(
      <AiCleanupSummaryBar
        suggestionData={suggestionData}
        totalTransactions={1}
        onBatchAccept={mockOnBatchAccept}
        isProcessing={false}
      />
    );

    const button = screen.getByText(/Alle mit ≥ 90 % übernehmen \(1\)/);
    fireEvent.click(button);

    expect(mockOnBatchAccept).toHaveBeenCalledTimes(1);
  });

  it('disables batch button and shows loading state when processing', () => {
    const suggestionData = new Map([
      ['tx1', createSuggestionData('tx1', 0.95)],
    ]);

    render(
      <AiCleanupSummaryBar
        suggestionData={suggestionData}
        totalTransactions={1}
        onBatchAccept={mockOnBatchAccept}
        isProcessing={true}
      />
    );

    const button = screen.getByText(/Wird übernommen.../) as HTMLButtonElement;
    expect(button).toBeInTheDocument();
    expect(button.disabled).toBe(true);
  });

  it('only counts suggestions that have been fetched', () => {
    const suggestionData = new Map([
      ['tx1', createSuggestionData('tx1', 0.95, true)], // Fetched
      ['tx2', { transactionId: 'tx2', suggestion: null, isLoading: true, hasFetched: false }], // Not fetched
      ['tx3', createSuggestionData('tx3', 0.85, true)], // Fetched
    ]);

    render(
      <AiCleanupSummaryBar
        suggestionData={suggestionData}
        totalTransactions={3}
        onBatchAccept={mockOnBatchAccept}
        isProcessing={false}
      />
    );

    // Should only count the 2 fetched suggestions
    expect(screen.getByText(/KI-Vorschläge: 2 von 3 Buchungen/)).toBeInTheDocument();
  });
});

