import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { GamificationHud } from '../components/GamificationHud';
import type { GamificationSummary } from '../../../hooks/useGamificationData';

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('GamificationHud', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders rank & XP bar when data is provided', () => {
    const data: GamificationSummary = {
      rank: 'Gold',
      xp: 500,
      xpToNext: 500,
      level: 10,
      currentStreakDays: 7,
      longestStreakDays: 14,
      completedQuestsThisWeek: 2,
      achievementsCompleted: 5,
      nextSuggestedQuest: null,
    };

    renderWithRouter(
      <GamificationHud data={data} isLoading={false} error={null} />
    );

    expect(screen.getByText(/Rang: Gold Guru/)).toBeInTheDocument();
    expect(screen.getByText(/500 XP/)).toBeInTheDocument();
    expect(screen.getByText(/Level 10/)).toBeInTheDocument();
  });

  it('renders streak when currentStreakDays > 0', () => {
    const data: GamificationSummary = {
      rank: 'Silver',
      xp: 250,
      xpToNext: 250,
      level: 5,
      currentStreakDays: 7,
      longestStreakDays: 14,
      completedQuestsThisWeek: 0,
      achievementsCompleted: 3,
      nextSuggestedQuest: null,
    };

    renderWithRouter(
      <GamificationHud data={data} isLoading={false} error={null} />
    );

    expect(screen.getByText(/Streak: 7 Tage/)).toBeInTheDocument();
  });

  it('renders nextSuggestedQuest CTA when available', () => {
    const data: GamificationSummary = {
      rank: 'Bronze',
      xp: 50,
      xpToNext: 150,
      level: 1,
      currentStreakDays: 0,
      longestStreakDays: 0,
      completedQuestsThisWeek: 0,
      achievementsCompleted: 1,
      nextSuggestedQuest: {
        id: 'cleanup_sonstiges',
        title: 'Räume Sonstiges auf',
        ctaLabel: 'Los geht\'s',
        ctaPath: '/review',
      },
    };

    renderWithRouter(
      <GamificationHud data={data} isLoading={false} error={null} />
    );

    const ctaButton = screen.getByText(/Nächste Herausforderung: Räume Sonstiges auf/);
    expect(ctaButton).toBeInTheDocument();

    ctaButton.click();
    expect(mockNavigate).toHaveBeenCalledWith('/review');
  });

  it('renders loading skeleton when isLoading is true', () => {
    const { container } = renderWithRouter(
      <GamificationHud data={null} isLoading={true} error={null} />
    );

    // Check for skeleton elements (should have animate-pulse)
    const section = container.querySelector('section');
    expect(section).toBeInTheDocument();
    expect(section?.className).toContain('animate-pulse');
  });

  it('renders error message when error is present', () => {
    const error = new Error('Failed to fetch');

    renderWithRouter(
      <GamificationHud data={null} isLoading={false} error={error} />
    );

    expect(screen.getByText(/Gamification gerade nicht verfügbar/)).toBeInTheDocument();
  });

  it('renders nothing when data is null and not loading and no error', () => {
    const { container } = renderWithRouter(
      <GamificationHud data={null} isLoading={false} error={null} />
    );

    // Should render nothing (or minimal placeholder)
    expect(container.firstChild).toBeNull();
  });

  it('shows "Maximaler Rang" when at Platinum rank', () => {
    const data: GamificationSummary = {
      rank: 'Platinum',
      xp: 1000,
      xpToNext: 0,
      level: 20,
      currentStreakDays: 0,
      longestStreakDays: 0,
      completedQuestsThisWeek: 0,
      achievementsCompleted: 20,
      nextSuggestedQuest: null,
    };

    renderWithRouter(
      <GamificationHud data={data} isLoading={false} error={null} />
    );

    expect(screen.getByText(/Maximaler Rang/)).toBeInTheDocument();
  });
});

