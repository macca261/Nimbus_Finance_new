/**
 * Gamification API Routes
 * 
 * Provides endpoints for gamification features (XP, levels, ranks, streaks).
 * This prepares Nimbus for future Pro tier features and enhanced user engagement.
 */

import { Router } from 'express';
import { getGamificationSummary } from '../services/gamificationService';

const router = Router();

/**
 * GET /api/gamification
 * 
 * Returns gamification summary for the current user (XP, rank, streak, quests).
 * 
 * For now, uses a single-user or dummy userId if auth is not implemented yet.
 */
router.get('/', async (req, res) => {
  try {
    // For now, use a single-user or dummy userId if auth is not implemented yet
    const userId = 'default';
    
    // getGamificationSummary always returns a valid summary (never throws)
    const summary = await getGamificationSummary(userId);
    
    res.json(summary);
  } catch (error: any) {
    // This catch block is defensive - getGamificationSummary should never throw,
    // but we handle it just in case
    console.error('[gamification] Error computing summary', error);
    
    // Fail soft with default summary
    res.status(500).json({ error: 'Failed to compute gamification summary' });
  }
});

export default router;

