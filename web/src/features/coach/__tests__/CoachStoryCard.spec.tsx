import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { CoachStoryCard } from '../components/CoachStoryCard';
import type { CoachStoryResponse } from '../../../api/coachApi';

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('CoachStoryCard', () => {
  it('renders story with title, insights, and actions', () => {
    const storyResponse: CoachStoryResponse = {
      story: {
        title: 'Dein Monat in kurzen Worten',
        insights: [
          'Du hast 120 € weniger für Essen ausgegeben als im Vormonat.',
          'Deine Top-Kategorie war Lebensmittel & Drogerie.',
        ],
        actions: ['Setze ein Sparziel für Urlaub', 'Überprüfe deine Abos in Sonstiges'],
      },
    };

    renderWithRouter(
      <CoachStoryCard storyResponse={storyResponse} isLoading={false} />
    );

    expect(screen.getByText('Dein Monat in kurzen Worten')).toBeInTheDocument();
    expect(screen.getByText(/Du hast 120 € weniger für Essen/)).toBeInTheDocument();
    expect(screen.getByText(/Deine Top-Kategorie war/)).toBeInTheDocument();
  });

  it('renders loading state', () => {
    renderWithRouter(
      <CoachStoryCard storyResponse={null} isLoading={true} />
    );

    expect(screen.getByText(/Money Coach denkt nach/)).toBeInTheDocument();
  });

  it('renders fallback metrics when story is null', () => {
    const fallbackResponse: CoachStoryResponse = {
      story: null,
      fallbackMetrics: {
        period: { start: '2025-01-01', end: '2025-01-31' },
        netCents: 50000,
        topCategory: 'Lebensmittel & Drogerie',
        topCategoryAmountCents: 15000,
      },
    };

    renderWithRouter(
      <CoachStoryCard storyResponse={fallbackResponse} isLoading={false} />
    );

    expect(screen.getByText(/In den letzten 30 Tagen war deine Top-Kategorie/)).toBeInTheDocument();
    expect(screen.getByText('Lebensmittel & Drogerie')).toBeInTheDocument();
  });

  it('does not render when disabled', () => {
    const disabledResponse: CoachStoryResponse = {
      story: null,
      disabled: true,
      message: 'AI coach is disabled.',
    };

    const { container } = renderWithRouter(
      <CoachStoryCard storyResponse={disabledResponse} isLoading={false} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('calls onRefresh when refresh button is clicked', async () => {
    const user = await import('@testing-library/user-event').then(m => m.default);
    const onRefresh = vi.fn();

    const storyResponse: CoachStoryResponse = {
      story: {
        title: 'Test',
        insights: ['Insight 1'],
        actions: [],
      },
    };

    renderWithRouter(
      <CoachStoryCard storyResponse={storyResponse} isLoading={false} onRefresh={onRefresh} />
    );

    const refreshButton = screen.getByTitle('Aktualisieren');
    await user.click(refreshButton);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('renders action buttons with correct labels', () => {
    const storyResponse: CoachStoryResponse = {
      story: {
        title: 'Test',
        insights: ['Insight 1'],
        actions: ['Setze ein Budget anlegen', 'Überprüfe deine Abos'],
      },
    };

    renderWithRouter(
      <CoachStoryCard storyResponse={storyResponse} isLoading={false} />
    );

    // Action buttons should be present (labels are cleaned)
    expect(screen.getByText(/Budget/)).toBeInTheDocument();
    expect(screen.getByText(/Abos/)).toBeInTheDocument();
  });

  it('renders empty state when isEmpty is true', () => {
    const emptyResponse: CoachStoryResponse = {
      story: null,
      isEmpty: true,
      fallbackMetrics: {
        period: { start: '2025-01-01', end: '2025-01-31' },
        netCents: 0,
        topCategory: null,
        topCategoryAmountCents: 0,
      },
    };

    renderWithRouter(
      <CoachStoryCard storyResponse={emptyResponse} isLoading={false} />
    );

    expect(screen.getByText(/Noch keine Daten – importiere Buchungen/)).toBeInTheDocument();
  });

  it('renders empty state when fallbackMetrics has no topCategory', () => {
    const emptyResponse: CoachStoryResponse = {
      story: null,
      fallbackMetrics: {
        period: { start: '2025-01-01', end: '2025-01-31' },
        netCents: 0,
        topCategory: null,
        topCategoryAmountCents: 0,
      },
    };

    renderWithRouter(
      <CoachStoryCard storyResponse={emptyResponse} isLoading={false} />
    );

    expect(screen.getByText(/Noch keine Daten – importiere Buchungen/)).toBeInTheDocument();
  });

  it('renders error state with retry button', async () => {
    const user = await import('@testing-library/user-event').then(m => m.default);
    const onRefresh = vi.fn();
    const error = new Error('Network error');

    renderWithRouter(
      <CoachStoryCard storyResponse={null} isLoading={false} error={error} onRefresh={onRefresh} />
    );

    expect(screen.getByText(/Die Zusammenfassung konnte nicht geladen werden/)).toBeInTheDocument();
    const retryButton = screen.getByText(/Erneut versuchen/);
    expect(retryButton).toBeInTheDocument();

    await user.click(retryButton);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('shows "Neu" pill when isFresh is true', () => {
    const storyResponse: CoachStoryResponse = {
      story: {
        title: 'Dein Monat in kurzen Worten',
        insights: ['Insight 1'],
        actions: [],
      },
    };

    renderWithRouter(
      <CoachStoryCard storyResponse={storyResponse} isLoading={false} isFresh={true} />
    );

    expect(screen.getByText('Neu')).toBeInTheDocument();
  });

  it('does not show "Neu" pill when isFresh is false', () => {
    const storyResponse: CoachStoryResponse = {
      story: {
        title: 'Dein Monat in kurzen Worten',
        insights: ['Insight 1'],
        actions: [],
      },
    };

    renderWithRouter(
      <CoachStoryCard storyResponse={storyResponse} isLoading={false} isFresh={false} />
    );

    expect(screen.queryByText('Neu')).not.toBeInTheDocument();
  });

  it('does not show "Neu" pill when isFresh is undefined', () => {
    const storyResponse: CoachStoryResponse = {
      story: {
        title: 'Dein Monat in kurzen Worten',
        insights: ['Insight 1'],
        actions: [],
      },
    };

    renderWithRouter(
      <CoachStoryCard storyResponse={storyResponse} isLoading={false} />
    );

    expect(screen.queryByText('Neu')).not.toBeInTheDocument();
  });
});

