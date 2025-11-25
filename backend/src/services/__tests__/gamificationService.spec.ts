import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getGamificationSummary } from '../gamificationService';
import * as achievementsService from '../achievementsService';
import * as questsService from '../questsService';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';

// Mock dependencies
vi.mock('../achievementsService', () => ({
  getAchievementsForUser: vi.fn(),
}));

vi.mock('../questsService', () => ({
  getQuestsForUser: vi.fn(),
  getUserQuestStates: vi.fn(),
}));

describe('gamificationService', () => {
  const mockDb = {} as BetterSqliteDatabase;
  const userId = 'test-user';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates Bronze rank for low XP', async () => {
    vi.mocked(achievementsService.getAchievementsForUser).mockResolvedValue([
      { status: 'completed' } as any,
      { status: 'locked' } as any,
    ]);
    vi.mocked(questsService.getUserQuestStates).mockReturnValue([
      { status: 'COMPLETED' } as any,
    ]);

    const summary = await getGamificationSummary(userId, mockDb);

    expect(summary.rank).toBe('Bronze');
    expect(summary.xp).toBe(80); // 1 achievement * 50 + 1 quest * 30
    expect(summary.xpToNext).toBe(120); // 200 - 80
  });

  it('calculates Silver rank for medium XP', async () => {
    // 5 achievements = 250 XP (Silver threshold)
    vi.mocked(achievementsService.getAchievementsForUser).mockResolvedValue(
      Array(5).fill({ status: 'completed' }) as any[]
    );
    vi.mocked(questsService.getUserQuestStates).mockReturnValue([]);

    const summary = await getGamificationSummary(userId, mockDb);

    expect(summary.rank).toBe('Silver');
    expect(summary.xp).toBe(250); // 5 achievements * 50
    expect(summary.xpToNext).toBe(250); // 500 - 250
  });

  it('calculates Gold rank for high XP', async () => {
    // 10 achievements = 500 XP (Gold threshold)
    vi.mocked(achievementsService.getAchievementsForUser).mockResolvedValue(
      Array(10).fill({ status: 'completed' }) as any[]
    );
    vi.mocked(questsService.getUserQuestStates).mockReturnValue([]);

    const summary = await getGamificationSummary(userId, mockDb);

    expect(summary.rank).toBe('Gold');
    expect(summary.xp).toBe(500);
    expect(summary.xpToNext).toBe(500); // 1000 - 500
  });

  it('calculates Platinum rank for very high XP', async () => {
    // 20 achievements = 1000 XP (Platinum threshold)
    vi.mocked(achievementsService.getAchievementsForUser).mockResolvedValue(
      Array(20).fill({ status: 'completed' }) as any[]
    );
    vi.mocked(questsService.getUserQuestStates).mockReturnValue([]);

    const summary = await getGamificationSummary(userId, mockDb);

    expect(summary.rank).toBe('Platinum');
    expect(summary.xp).toBe(1000);
    expect(summary.xpToNext).toBe(0); // Max rank
  });

  it('returns nextSuggestedQuest when active quest exists', async () => {
    vi.mocked(achievementsService.getAchievementsForUser).mockResolvedValue([]);
    vi.mocked(questsService.getUserQuestStates).mockReturnValue([]);
    vi.mocked(questsService.getQuestsForUser).mockReturnValue([
      {
        id: 'cleanup_sonstiges',
        title: 'Räume Sonstiges auf',
        status: 'ACTIVE',
        cta: { label: 'Los geht\'s', href: '/review' },
      } as any,
    ]);

    const summary = await getGamificationSummary(userId, mockDb);

    expect(summary.nextSuggestedQuest).toEqual({
      id: 'cleanup_sonstiges',
      title: 'Räume Sonstiges auf',
      ctaLabel: 'Los geht\'s',
      ctaPath: '/review',
    });
  });

  it('returns null for nextSuggestedQuest when no active quests', async () => {
    vi.mocked(achievementsService.getAchievementsForUser).mockResolvedValue([]);
    vi.mocked(questsService.getUserQuestStates).mockReturnValue([]);
    vi.mocked(questsService.getQuestsForUser).mockReturnValue([]);

    const summary = await getGamificationSummary(userId, mockDb);

    expect(summary.nextSuggestedQuest).toBeNull();
  });

  it('handles errors gracefully and returns default summary', async () => {
    vi.mocked(achievementsService.getAchievementsForUser).mockRejectedValue(
      new Error('Database error')
    );
    vi.mocked(questsService.getUserQuestStates).mockReturnValue([]);

    const summary = await getGamificationSummary(userId, mockDb);

    // Should return default values, not throw
    expect(summary.rank).toBe('Bronze');
    expect(summary.xp).toBe(0);
    expect(summary.xpToNext).toBe(200);
  });
});

