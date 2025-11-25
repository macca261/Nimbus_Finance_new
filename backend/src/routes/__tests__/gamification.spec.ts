import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import gamificationRouter from '../gamification';
import * as gamificationService from '../../services/gamificationService';

// Mock the service
vi.mock('../../services/gamificationService', () => ({
  getGamificationSummary: vi.fn(),
}));

describe('GET /api/gamification', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/gamification', gamificationRouter);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with valid gamification summary', async () => {
    const mockSummary = {
      rank: 'Gold' as const,
      xp: 500,
      xpToNext: 500,
      level: 10,
      currentStreakDays: 7,
      longestStreakDays: 14,
      completedQuestsThisWeek: 2,
      achievementsCompleted: 5,
      nextSuggestedQuest: {
        id: 'cleanup_sonstiges',
        title: 'Räume Sonstiges auf',
        ctaLabel: 'Los geht\'s',
        ctaPath: '/review',
      },
    };

    vi.mocked(gamificationService.getGamificationSummary).mockResolvedValue(mockSummary);

    const res = await request(app).get('/api/gamification');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockSummary);
  });

  it('returns 500 when service throws', async () => {
    vi.mocked(gamificationService.getGamificationSummary).mockRejectedValue(
      new Error('Database error')
    );

    const res = await request(app).get('/api/gamification');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toBe('Failed to compute gamification summary');
  });

  it('handles empty/default summary gracefully', async () => {
    const defaultSummary = {
      rank: 'Bronze' as const,
      xp: 0,
      xpToNext: 200,
      level: 1,
      currentStreakDays: 0,
      longestStreakDays: 0,
      completedQuestsThisWeek: 0,
      achievementsCompleted: 0,
      nextSuggestedQuest: null,
    };

    vi.mocked(gamificationService.getGamificationSummary).mockResolvedValue(defaultSummary);

    const res = await request(app).get('/api/gamification');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(defaultSummary);
  });
});

