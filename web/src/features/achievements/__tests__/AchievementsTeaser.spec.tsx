import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AchievementsTeaser } from '../components/AchievementsTeaser';
import { useAchievements } from '../../../hooks/useAchievements';
import type { Achievement } from '../../../types/achievements';

vi.mock('../../../hooks/useAchievements');

const renderWithRouter = (component: React.ReactElement) => {
  return render(<MemoryRouter>{component}</MemoryRouter>);
};

describe('AchievementsTeaser', () => {
  const mockUseAchievements = vi.mocked(useAchievements);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state', () => {
    mockUseAchievements.mockReturnValue({
      achievements: [],
      isLoading: true,
      error: null,
      evaluate: vi.fn(),
      refetch: vi.fn(),
    });

    const { container } = renderWithRouter(<AchievementsTeaser />);
    // Loading state shows skeleton
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders nothing when no achievements', () => {
    mockUseAchievements.mockReturnValue({
      achievements: [],
      isLoading: false,
      error: null,
      evaluate: vi.fn(),
      refetch: vi.fn(),
    });

    const { container } = renderWithRouter(<AchievementsTeaser />);
    expect(container.firstChild).toBeNull();
  });

  it('shows in-progress achievement with progress', () => {
    const mockAchievement: Achievement = {
      id: '1',
      key: 'first_import',
      title: 'Erster CSV-Import 🎉',
      description: 'Du hast deine erste CSV-Datei importiert.',
      type: 'import',
      status: 'in_progress',
      progress: 75,
    };

    mockUseAchievements.mockReturnValue({
      achievements: [mockAchievement],
      isLoading: false,
      error: null,
      evaluate: vi.fn(),
      refetch: vi.fn(),
    });

    renderWithRouter(<AchievementsTeaser />);
    expect(screen.getByText('Erster CSV-Import 🎉')).toBeInTheDocument();
    expect(screen.getByText(/75% erreicht/i)).toBeInTheDocument();
  });

  it('shows completed achievement', () => {
    const mockAchievement: Achievement = {
      id: '1',
      key: 'first_import',
      title: 'Erster CSV-Import 🎉',
      description: 'Du hast deine erste CSV-Datei importiert.',
      type: 'import',
      status: 'completed',
      progress: 100,
      unlockedAt: new Date().toISOString(),
    };

    mockUseAchievements.mockReturnValue({
      achievements: [mockAchievement],
      isLoading: false,
      error: null,
      evaluate: vi.fn(),
      refetch: vi.fn(),
    });

    renderWithRouter(<AchievementsTeaser />);
    expect(screen.getByText('Erster CSV-Import 🎉')).toBeInTheDocument();
    expect(screen.getByText(/Abgeschlossen/i)).toBeInTheDocument();
  });

  it('shows link to achievements page', () => {
    const mockAchievement: Achievement = {
      id: '1',
      key: 'first_import',
      title: 'Erster CSV-Import 🎉',
      description: 'Du hast deine erste CSV-Datei importiert.',
      type: 'import',
      status: 'in_progress',
      progress: 50,
    };

    mockUseAchievements.mockReturnValue({
      achievements: [mockAchievement],
      isLoading: false,
      error: null,
      evaluate: vi.fn(),
      refetch: vi.fn(),
    });

    renderWithRouter(<AchievementsTeaser />);
    const link = screen.getByText(/Alle Erfolge ansehen/i);
    expect(link).toBeInTheDocument();
    expect(link.closest('a')?.getAttribute('href')).toBe('/achievements');
  });

  it('shows up to 2 achievements', () => {
    const mockAchievements: Achievement[] = [
      {
        id: '1',
        key: 'first_import',
        title: 'Erster CSV-Import 🎉',
        description: 'Du hast deine erste CSV-Datei importiert.',
        type: 'import',
        status: 'completed',
        progress: 100,
        unlockedAt: new Date().toISOString(),
      },
      {
        id: '2',
        key: 'transactions_50',
        title: '50 Buchungen',
        description: 'Du hast 50 Transaktionen importiert.',
        type: 'import',
        status: 'in_progress',
        progress: 60,
      },
      {
        id: '3',
        key: 'streak_7',
        title: '7 Tage in Folge aktiv',
        description: 'Mindestens 7 aufeinanderfolgende Tage mit Buchungen.',
        type: 'streak',
        status: 'locked',
        progress: 0,
      },
    ];

    mockUseAchievements.mockReturnValue({
      achievements: mockAchievements,
      isLoading: false,
      error: null,
      evaluate: vi.fn(),
      refetch: vi.fn(),
    });

    renderWithRouter(<AchievementsTeaser />);
    expect(screen.getByText('Erster CSV-Import 🎉')).toBeInTheDocument();
    expect(screen.getByText('50 Buchungen')).toBeInTheDocument();
    // Third achievement should not be shown
    expect(screen.queryByText('7 Tage in Folge aktiv')).not.toBeInTheDocument();
  });
});

