import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MonthlySnapshotCard } from '../MonthlySnapshotCard';
import type { MonthlyInsights } from '../../../lib/hooks/useMonthlyInsights';

describe('MonthlySnapshotCard', () => {
  it('renders the card with mocked data', () => {
    const insights: MonthlyInsights = {
      topCategory: {
        legacyCategoryId: 'groceries',
        labelDe: 'Lebensmittel & Drogerie',
        amountCents: 12500, // 125 EUR
      },
      biggestExpense: {
        amountCents: 5000, // 50 EUR
        label: 'REWE Markt',
      },
      transactionCount: 42,
      isLoading: false,
    };

    render(<MonthlySnapshotCard insights={insights} />);

    expect(screen.getByText('Dein Monat')).toBeInTheDocument();
    expect(screen.getByText('Letzte 30 Tage')).toBeInTheDocument();
    expect(screen.getByText('Top-Kategorie')).toBeInTheDocument();
    expect(screen.getByText('Lebensmittel & Drogerie')).toBeInTheDocument();
    expect(screen.getByText('Größte Ausgabe')).toBeInTheDocument();
    expect(screen.getByText('REWE Markt')).toBeInTheDocument();
    expect(screen.getByText('Buchungen')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    const insights: MonthlyInsights = {
      transactionCount: 0,
      isLoading: true,
    };

    render(<MonthlySnapshotCard insights={insights} />);

    expect(screen.getByText('Lade Daten…')).toBeInTheDocument();
    expect(screen.queryByText('Top-Kategorie')).not.toBeInTheDocument();
  });

  it('renders error state', () => {
    const insights: MonthlyInsights = {
      transactionCount: 0,
      isLoading: false,
      error: 'Konnte Monatsüberblick nicht laden',
    };

    render(<MonthlySnapshotCard insights={insights} />);

    expect(screen.getByText('Konnte Monatsüberblick nicht laden')).toBeInTheDocument();
  });

  it('renders fallback dashes when no data', () => {
    const insights: MonthlyInsights = {
      transactionCount: 0,
      isLoading: false,
    };

    render(<MonthlySnapshotCard insights={insights} />);

    // Should show dashes for missing data
    const dashes = screen.getAllByText('–');
    expect(dashes.length).toBeGreaterThan(0);
    expect(screen.getByText('0')).toBeInTheDocument(); // Transaction count should be 0
  });

  it('renders long merchant labels with wrapping', () => {
    const longLabel = 'A' + 'B'.repeat(50) + 'C'; // 52 characters
    const insights: MonthlyInsights = {
      biggestExpense: {
        amountCents: 5000,
        label: longLabel,
      },
      transactionCount: 1,
      isLoading: false,
    };

    render(<MonthlySnapshotCard insights={insights} />);

    // The label should be rendered (may wrap on smaller screens, but should be visible)
    expect(screen.getByText(longLabel)).toBeInTheDocument();
  });
});

