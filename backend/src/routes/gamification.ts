/**
 * Gamification API Routes
 * 
 * Provides endpoints for gamification features (XP, levels, ranks, streaks).
 * This prepares Nimbus for future Pro tier features and enhanced user engagement.
 */

import { Router } from 'express';
import { getGamificationSnapshot } from '../services/gamificationService';

const router = Router();

/**
 * GET /api/gamification
 * 
 * Returns gamification snapshot for the current user (XP, level, rank, streak, quests).
 * 
 * For now, uses a single-user or dummy userId if auth is not implemented yet.
 */
router.get('/gamification', async (req, res) => {
  try {
    // For now, use a single-user or dummy userId if auth is not implemented yet
    const userId = 'default';
    
    // getGamificationSnapshot now always returns a valid snapshot (never throws)
    const snapshot = getGamificationSnapshot(userId);
    
    res.json(snapshot);
  } catch (error: any) {
    // This catch block is now defensive - getGamificationSnapshot should never throw,
    // but we handle it just in case
    if (process.env.NODE_ENV !== 'production') {
      console.error('[gamification] Unexpected error fetching snapshot:', error);
    }
    
    // Fail soft with default snapshot
    res.status(200).json({
      xp: 0,
      level: 1,
      rankLabel: 'Bronze Budgeter',
      streakDays: 0,
      activeQuests: [],
      recentlyCompletedQuests: [],
    });
  }
});

export default router;

