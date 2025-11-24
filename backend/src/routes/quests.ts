/**
 * Quests API Routes (v0)
 * 
 * Provides endpoints for fetching active quests (gamification tasks)
 * that guide users toward better financial organization.
 * 
 * Uses the new Quest Engine with QuestDefinition/UserQuestState models.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';
import { getQuestsForUser } from '../services/questsService';

const filePath = process.env.NIMBUS_DB_PATH || process.env.DB_FILE || 'nimbus.db';
const fallbackDb = new BetterSqlite3(filePath);

export const questsRouter = Router();

function getDb(req: any): BetterSqliteDatabase {
  return ((req.app as any)?.locals?.db ?? null) || fallbackDb;
}

/**
 * GET /api/quests
 * 
 * Returns active quests for the user based on current data.
 * Progress is computed from existing metrics (transactions, imports, etc.).
 * 
 * **Response format:**
 * ```json
 * {
 *   "quests": [
 *     {
 *       "id": "cleanup_sonstiges",
 *       "title": "Räume Sonstiges auf",
 *       "description": "Bringe deine 'Sonstiges'-Buchungen in Ordnung.",
 *       "kind": "CLEANUP",
 *       "status": "ACTIVE",
 *       "currentValue": 5,
 *       "targetValue": 0,
 *       "progressPercent": 60,
 *       "cta": {
 *         "label": "Los geht's",
 *         "href": "/review"
 *       }
 *     }
 *   ]
 * }
 * ```
 */
questsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const db = getDb(req);
    const userId = 'default'; // For now, single-user app

    const quests = getQuestsForUser(db, userId);

    res.json({ quests });
  } catch (error: any) {
    console.error('[quests] GET / error:', error);
    res.status(500).json({
      error: 'Failed to load quests',
      message: error?.message || 'Unknown error',
    });
  }
});

/**
 * GET /api/quests/active (backward compatibility)
 * 
 * Alias for GET /api/quests
 */
questsRouter.get('/active', async (req: Request, res: Response) => {
  try {
    const db = getDb(req);
    const userId = 'default';

    const quests = getQuestsForUser(db, userId);

    res.json({ quests });
  } catch (error: any) {
    console.error('[quests] GET /active error:', error);
    res.status(500).json({
      error: 'Failed to load quests',
      message: error?.message || 'Unknown error',
    });
  }
});

