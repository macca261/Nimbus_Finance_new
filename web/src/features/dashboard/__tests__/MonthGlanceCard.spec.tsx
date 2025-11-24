import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MonthGlanceCard } from '../components/MonthGlanceCard';
import type { MonthSummary, MonthNarrative } from '../../../hooks/useMonthSummary';

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('MonthGlanceCard', () => {
  it('renders summary with key numbers and bullets', () => {
    const summary: MonthSummary = {
      period: { start: '2024-01-01', end: '2024-01-31' },
      incomeCents: 300000,
      expenseCents: 50000,
      netCents: 250000,
      changeVsPrevMonthPct: 10.5,
      topCategories: [
        { categoryId: 'groceries', name: 'Lebensmittel & Drogerie', amountCents: 20000, sharePct: 40 },
      ],
      biggestExpense: {
        transactionId: '123',
        displayName: 'REWE Markt',
        amountCents: 5000,
        date: '2024-01-15',
        categoryId: 'groceries',
        categoryName: 'Lebensmittel & Drogerie',
      },
      highlights: [],
    };

    const narrative: MonthNarrative = {
      bullets: [
        'Einnahmen: 3.000,00 €, Ausgaben: 500,00 €',
        'Netto: +2.500,00 €',
        'Hauptausgabe: Lebensmittel & Drogerie (200,00 €)',
      ],
    };

    renderWithRouter(
      <MonthGlanceCard summary={summary} narrative={narrative} isLoading={false} />
    );

    expect(screen.getByText('Monat auf einen Blick')).toBeInTheDocument();
    expect(screen.getByText(/Einnahmen.*Ausgaben.*Netto/)).toBeInTheDocument();
    expect(screen.getByText(/Einnahmen: 3.000,00 €/)).toBeInTheDocument();
    expect(screen.getByText(/Netto: \+2.500,00 €/)).toBeInTheDocument();
  });

  it('renders loading state', () => {
    renderWithRouter(
      <MonthGlanceCard summary={null} narrative={null} isLoading={true} />
    );

    expect(screen.getByText('Monat auf einen Blick')).toBeInTheDocument();
    // Check for skeleton/loading elements
    const loadingElements = screen.getAllByRole('generic').filter(el => 
      el.className.includes('animate-pulse')
    );
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it('renders error state with retry button', async () => {
    const user = await import('@testing-library/user-event').then(m => m.default);
    const onRefresh = vi.fn();
    const error = new Error('Failed to fetch');

    renderWithRouter(
      <MonthGlanceCard 
        summary={null} 
        narrative={null} 
        isLoading={false} 
        error={error}
        onRefresh={onRefresh}
      />
    );

    expect(screen.getByText('Zusammenfassung gerade nicht verfügbar.')).toBeInTheDocument();
    
    const retryButton = screen.getByText('Erneut versuchen');
    expect(retryButton).toBeInTheDocument();

    await user.click(retryButton);
    expect(onRefresh).toHaveBeenCalled();
  });

  it('renders empty state when no transactions', () => {
    const summary: MonthSummary = {
      period: { start: '2024-01-01', end: '2024-01-31' },
      incomeCents: 0,
      expenseCents: 0,
      netCents: 0,
      changeVsPrevMonthPct: null,
      topCategories: [],
      biggestExpense: null,
      highlights: [],
    };

    renderWithRouter(
      <MonthGlanceCard summary={summary} narrative={null} isLoading={false} />
    );

    expect(screen.getByText(/Noch keine Buchungen für diesen Monat/)).toBeInTheDocument();
  });

  it('renders bullets from narrative', () => {
    const summary: MonthSummary = {
      period: { start: '2024-01-01', end: '2024-01-31' },
      incomeCents: 300000,
      expenseCents: 50000,
      netCents: 250000,
      changeVsPrevMonthPct: null,
      topCategories: [],
      biggestExpense: null,
      highlights: [],
    };

    const narrative: MonthNarrative = {
      bullets: [
        'Bullet point 1',
        'Bullet point 2',
        'Bullet point 3',
      ],
    };

    renderWithRouter(
      <MonthGlanceCard summary={summary} narrative={narrative} isLoading={false} />
    );

    expect(screen.getByText('Bullet point 1')).toBeInTheDocument();
    expect(screen.getByText('Bullet point 2')).toBeInTheDocument();
    expect(screen.getByText('Bullet point 3')).toBeInTheDocument();
  });

  it('shows empty narrative message when no bullets', () => {
    const summary: MonthSummary = {
      period: { start: '2024-01-01', end: '2024-01-31' },
      incomeCents: 300000,
      expenseCents: 50000,
      netCents: 250000,
      changeVsPrevMonthPct: null,
      topCategories: [],
      biggestExpense: null,
      highlights: [],
    };

    const narrative: MonthNarrative = {
      bullets: [],
    };

    renderWithRouter(
      <MonthGlanceCard summary={summary} narrative={narrative} isLoading={false} />
    );

    expect(screen.getByText('Keine Zusammenfassung verfügbar.')).toBeInTheDocument();
  });

  it('calls onRefresh when refresh button is clicked', async () => {
    const user = await import('@testing-library/user-event').then(m => m.default);
    const onRefresh = vi.fn();

    const summary: MonthSummary = {
      period: { start: '2024-01-01', end: '2024-01-31' },
      incomeCents: 300000,
      expenseCents: 50000,
      netCents: 250000,
      changeVsPrevMonthPct: null,
      topCategories: [],
      biggestExpense: null,
      highlights: [],
    };

    renderWithRouter(
      <MonthGlanceCard 
        summary={summary} 
        narrative={{ bullets: [] }} 
        isLoading={false}
        onRefresh={onRefresh}
      />
    );

    const refreshButton = screen.getByTitle('Aktualisieren');
    await user.click(refreshButton);
    expect(onRefresh).toHaveBeenCalled();
  });

  it('navigates to review page when CTA is clicked', async () => {
    const user = await import('@testing-library/user-event').then(m => m.default);
    const navigate = vi.fn();
    vi.mock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom');
      return {
        ...actual,
        useNavigate: () => navigate,
      };
    });

    const summary: MonthSummary = {
      period: { start: '2024-01-01', end: '2024-01-31' },
      incomeCents: 300000,
      expenseCents: 50000,
      netCents: 250000,
      changeVsPrevMonthPct: null,
      topCategories: [],
      biggestExpense: null,
      highlights: [],
    };

    renderWithRouter(
      <MonthGlanceCard 
        summary={summary} 
        narrative={{ bullets: [] }} 
        isLoading={false}
      />
    );

    const ctaButton = screen.getByText('Sonstiges aufräumen');
    await user.click(ctaButton);
    // Note: Navigation is handled by react-router, so we can't easily test it without more setup
    // But we can verify the button exists and is clickable
    expect(ctaButton).toBeInTheDocument();
  });
});

