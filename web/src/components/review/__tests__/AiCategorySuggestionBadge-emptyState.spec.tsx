/**
 * Tests for AiCategorySuggestionBadge empty state
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AiCategorySuggestionBadge } from '../AiCategorySuggestionBadge';

describe('AiCategorySuggestionBadge - Empty State', () => {
  it('shows empty state pill when no suggestion and hasFetched is true', () => {
    render(
      <AiCategorySuggestionBadge
        suggestion={null}
        hasFetched={true}
      />
    );

    expect(screen.getByText('Keine sichere KI-Einschätzung')).toBeInTheDocument();
  });

  it('shows nothing when no suggestion and hasFetched is false', () => {
    const { container } = render(
      <AiCategorySuggestionBadge
        suggestion={null}
        hasFetched={false}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('shows nothing when loading', () => {
    const { container } = render(
      <AiCategorySuggestionBadge
        suggestion={null}
        isLoading={true}
        hasFetched={false}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('shows suggestion when available', () => {
    render(
      <AiCategorySuggestionBadge
        suggestion={{
          categoryId: 'groceries',
          confidence: 0.85,
          reasoning: 'Test reasoning',
        }}
        categoryLabel="Lebensmittel"
        hasFetched={true}
      />
    );

    expect(screen.getByText(/Vorschlag:/)).toBeInTheDocument();
    expect(screen.getByText('Lebensmittel')).toBeInTheDocument();
    expect(screen.getByText('(85%)')).toBeInTheDocument();
  });
});

