import { Router } from 'express';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import { getAchievementsForUser, evaluateAchievements } from '../services/achievementsService';

export const achievementsRouter = Router();

function getDb(req: any): BetterSqliteDatabase {
  return ((req.app as any)?.locals?.db ?? null);
}

// GET /api/achievements
// Returns all achievements for the current user with their status and progress
achievementsRouter.get('/', async (req, res) => {
  try {
    const userId = 'default'; // Single-user app
    const achievements = await getAchievementsForUser(userId);
    
    res.json({ data: achievements });
  } catch (e: any) {
    console.error('[achievements] GET error:', e);
    res.status(500).json({ error: e?.message || 'Failed to fetch achievements' });
  }
});

// POST /api/achievements/evaluate
// Re-evaluates all achievements based on current data
achievementsRouter.post('/evaluate', async (req, res) => {
  try {
    const userId = 'default'; // Single-user app
    const db = getDb(req);
    
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    const achievements = await evaluateAchievements(userId, db);
    
    res.json({ data: achievements });
  } catch (e: any) {
    console.error('[achievements] POST /evaluate error:', e);
    res.status(500).json({ error: e?.message || 'Failed to evaluate achievements' });
  }
});
