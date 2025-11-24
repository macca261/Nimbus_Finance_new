/**
 * Tests for QuestStrip component
 * 
 * Verifies rendering of quests, loading states, empty states, and navigation.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QuestStrip } from '../QuestStrip';
import type { Quest } from '../../../hooks/useQuests';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('QuestStrip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders multiple quests', async () => {
    const quests: Quest[] = [
      {
        id: 'cleanup_sonstiges',
        kind: 'CLEANUP',
        title: 'Räume Sonstiges auf',
        description: '3 Buchungen warten auf Kategorisierung.',
        status: 'ACTIVE',
        currentValue: 0,
        targetValue: 3,
        progressPercent: 0,
        progressCurrent: 0,
        progressTarget: 3,
        cta: { label: 'Los geht\'s', href: '/review' },
        ctaPath: '/review',
      },
      {
        id: 'import_more_data',
        kind: 'IMPORT',
        title: 'Erstelle dein erstes Budget',
        description: 'Plane deine Ausgaben und behalte den Überblick.',
        status: 'ACTIVE',
        currentValue: 0,
        targetValue: 1,
        progressPercent: 0,
        cta: { label: 'Importieren', href: '/budgets' },
        ctaPath: '/budgets',
      },
    ];

    render(
      <MemoryRouter>
        <QuestStrip quests={quests} isLoading={false} error={null} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Räume Sonstiges auf')).toBeInTheDocument();
      expect(screen.getByText('Erstelle dein erstes Budget')).toBeInTheDocument();
    });
  });

  it('shows loading state with skeleton chips', () => {
    render(
      <MemoryRouter>
        <QuestStrip quests={[]} isLoading={true} error={null} />
      </MemoryRouter>,
    );

    // Check for skeleton elements (they have animate-pulse class)
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no quests', () => {
    render(
      <MemoryRouter>
        <QuestStrip quests={[]} isLoading={false} error={null} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Alles erledigt/i)).toBeInTheDocument();
  });

  it('renders nothing on error (graceful degradation)', () => {
    const { container } = render(
      <MemoryRouter>
        <QuestStrip quests={[]} isLoading={false} error="Some error" />
      </MemoryRouter>,
    );

    // Should render nothing (null)
    expect(container.firstChild).toBeNull();
  });

  it('displays progress indicator when progress data is available', async () => {
    const quests: Quest[] = [
      {
        id: 'cleanup_sonstiges',
        kind: 'CLEANUP',
        title: 'Räume Sonstiges auf',
        description: '3 Buchungen warten auf Kategorisierung.',
        status: 'ACTIVE',
        currentValue: 1,
        targetValue: 3,
        progressPercent: 33,
        progressCurrent: 1,
        progressTarget: 3,
        cta: { label: 'Los geht\'s', href: '/review' },
        ctaPath: '/review',
      },
    ];

    render(
      <MemoryRouter>
        <QuestStrip quests={quests} isLoading={false} error={null} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/1 \/ 3 geschafft/i)).toBeInTheDocument();
      // Check for progress bar
      const progressBar = document.querySelector('.bg-nf-primary');
      expect(progressBar).toBeInTheDocument();
    });
  });

  it('navigates to correct path when CTA is clicked', async () => {
    const quests: Quest[] = [
      {
        id: 'cleanup_sonstiges',
        kind: 'CLEANUP',
        title: 'Räume Sonstiges auf',
        description: '3 Buchungen warten auf Kategorisierung.',
        status: 'ACTIVE',
        currentValue: 3,
        targetValue: 0,
        progressPercent: 0,
        progressCurrent: 3,
        progressTarget: 0,
        cta: { label: 'Los geht\'s', href: '/review' },
        ctaPath: '/review',
      },
    ];

    render(
      <MemoryRouter>
        <QuestStrip quests={quests} isLoading={false} error={null} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const button = screen.getByText('Los geht\'s').closest('button');
      expect(button).toBeInTheDocument();
    });

    const button = screen.getByText('Los geht\'s').closest('button');
    button?.click();

    expect(mockNavigate).toHaveBeenCalledWith('/review');
  });

  it('displays short display names instead of raw booking text', async () => {
    const quests: Quest[] = [
      {
        id: 'cleanup_sonstiges',
        kind: 'CLEANUP',
        title: 'Räume Sonstiges auf',
        description: '3 Buchungen warten auf Kategorisierung.',
        status: 'ACTIVE',
        currentValue: 0,
        targetValue: 3,
        progressPercent: 0,
        progressCurrent: 0,
        progressTarget: 3,
        cta: { label: 'Los geht\'s', href: '/review' },
        ctaPath: '/review',
      },
    ];

    render(
      <MemoryRouter>
        <QuestStrip quests={quests} isLoading={false} error={null} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      // Verify description is short and friendly (not raw booking text)
      const description = screen.getByText(/3 Buchungen warten auf Kategorisierung/i);
      expect(description).toBeInTheDocument();
      // Verify it's NOT showing raw booking text patterns
      expect(description.textContent).not.toMatch(/Kartenzahlung.*Buchungstext/i);
    });
  });

  it('handles quests without progress data', async () => {
    const quests: Quest[] = [
      {
        id: 'import_more_data',
        kind: 'IMPORT',
        title: 'Erstelle dein erstes Budget',
        description: 'Plane deine Ausgaben und behalte den Überblick.',
        status: 'ACTIVE',
        currentValue: 0,
        targetValue: 1,
        progressPercent: 0,
        cta: { label: 'Importieren', href: '/budgets' },
        ctaPath: '/budgets',
      },
    ];

    render(
      <MemoryRouter>
        <QuestStrip quests={quests} isLoading={false} error={null} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Erstelle dein erstes Budget')).toBeInTheDocument();
      // Should not show progress indicator
      expect(screen.queryByText(/\d+ \/ \d+ geschafft/i)).not.toBeInTheDocument();
    });
  });
});

