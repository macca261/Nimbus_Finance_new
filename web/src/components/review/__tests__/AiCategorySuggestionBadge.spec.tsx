import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiCategorySuggestionBadge } from '../AiCategorySuggestionBadge';
import type { AiCategorySuggestion } from '../../../api/aiCategoryApi';

describe('AiCategorySuggestionBadge', () => {
  const mockSuggestion: AiCategorySuggestion = {
    categoryId: 'groceries',
    confidence: 0.85,
    reasoning: 'Die Beschreibung enthält "Lidl", was auf einen Lebensmitteleinkauf hindeutet.',
  };

  it('renders suggestion with category label and confidence', () => {
    const onAccept = vi.fn();
    render(
      <AiCategorySuggestionBadge
        suggestion={mockSuggestion}
        categoryLabel="Lebensmittel & Supermarkt"
        onAccept={onAccept}
      />
    );

    expect(screen.getByText(/Vorschlag:/)).toBeInTheDocument();
    expect(screen.getByText('Lebensmittel & Supermarkt')).toBeInTheDocument();
    // Confidence is split across elements: "(85%)" - use getAllByText since there are multiple matches
    const confidenceElements = screen.getAllByText((content, element) => {
      return element?.textContent?.includes('85') && element?.textContent?.includes('%') || false;
    });
    expect(confidenceElements.length).toBeGreaterThan(0);
  });

  it('renders reasoning when provided', () => {
    const onAccept = vi.fn();
    render(
      <AiCategorySuggestionBadge
        suggestion={mockSuggestion}
        categoryLabel="Lebensmittel & Supermarkt"
        onAccept={onAccept}
      />
    );

    expect(screen.getByText(mockSuggestion.reasoning!)).toBeInTheDocument();
  });

  it('does not render reasoning when not provided', () => {
    const onAccept = vi.fn();
    const suggestionWithoutReasoning: AiCategorySuggestion = {
      categoryId: 'groceries',
      confidence: 0.75,
    };

    render(
      <AiCategorySuggestionBadge
        suggestion={suggestionWithoutReasoning}
        categoryLabel="Lebensmittel & Supermarkt"
        onAccept={onAccept}
      />
    );

    expect(screen.queryByText(/Die Beschreibung/)).not.toBeInTheDocument();
  });

  it('calls onAccept with categoryId when "Übernehmen" is clicked', async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();

    render(
      <AiCategorySuggestionBadge
        suggestion={mockSuggestion}
        categoryLabel="Lebensmittel & Supermarkt"
        onAccept={onAccept}
      />
    );

    const acceptButton = screen.getByRole('button', { name: /Übernehmen/i });
    await user.click(acceptButton);

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onAccept).toHaveBeenCalledWith('groceries');
  });

  it('calls onDismiss when dismiss button is clicked', async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    const onDismiss = vi.fn();

    render(
      <AiCategorySuggestionBadge
        suggestion={mockSuggestion}
        categoryLabel="Lebensmittel & Supermarkt"
        onAccept={onAccept}
        onDismiss={onDismiss}
      />
    );

    const dismissButton = screen.getByRole('button', { name: '' }); // X button has no accessible name
    await user.click(dismissButton);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not render dismiss button when onDismiss is not provided', () => {
    const onAccept = vi.fn();

    render(
      <AiCategorySuggestionBadge
        suggestion={mockSuggestion}
        categoryLabel="Lebensmittel & Supermarkt"
        onAccept={onAccept}
      />
    );

    // Dismiss button should not be present
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1); // Only the "Übernehmen" button
  });

  it('disables buttons when isLoading is true', () => {
    const onAccept = vi.fn();

    render(
      <AiCategorySuggestionBadge
        suggestion={mockSuggestion}
        categoryLabel="Lebensmittel & Supermarkt"
        onAccept={onAccept}
        isLoading={true}
      />
    );

    const acceptButton = screen.getByRole('button', { name: /Wird übernommen/i }) as HTMLButtonElement;
    expect(acceptButton.disabled).toBe(true);
  });

  it('shows loading text when isLoading is true', () => {
    const onAccept = vi.fn();

    render(
      <AiCategorySuggestionBadge
        suggestion={mockSuggestion}
        categoryLabel="Lebensmittel & Supermarkt"
        onAccept={onAccept}
        isLoading={true}
      />
    );

    expect(screen.getByText('Wird übernommen...')).toBeInTheDocument();
  });
});

