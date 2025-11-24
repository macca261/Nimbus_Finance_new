import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';
import { getAiConfig } from '../config/ai';
import { getMoneyCoachMetrics } from '../services/moneyCoachMetricsService';
import { getAiCoachStory } from '../services/aiCoachService';

const coachRouter = Router();

const filePath = process.env.NIMBUS_DB_PATH || process.env.DB_FILE || 'nimbus.db';
const fallbackDb = new BetterSqlite3(filePath);

function getDb(req: any): BetterSqliteDatabase {
  return ((req.app as any)?.locals?.db ?? null) || fallbackDb;
}

/**
 * GET /api/coach/story?days=30
 * Returns an AI-generated monthly story and coaching insights.
 */
coachRouter.get('/story', async (req: Request, res: Response) => {
  const db = getDb(req);
  if (!db) {
    return res.status(500).json({ error: 'Database not available' });
  }

  const config = getAiConfig();
  
  // Check if coach is enabled
  if (!config.coachEnabled) {
    return res.status(503).json({ 
      story: null, 
      disabled: true, 
      message: 'AI coach is disabled.' 
    });
  }

  if (!config.apiKey) {
    return res.status(500).json({ 
      story: null, 
      disabled: true, 
      message: 'AI API key is not configured.' 
    });
  }

  const days = Number.parseInt((req.query.days as string) || '30', 10);
  if (days < 1 || days > 365) {
    return res.status(400).json({ error: 'days must be between 1 and 365' });
  }

  try {
    // Get metrics
    const metrics = await getMoneyCoachMetrics(db, { days });

    // If no transactions exist, return empty state
    if (metrics.totalIncomeCents === 0 && metrics.totalExpenseCents === 0) {
      return res.json({
        story: null,
        fallbackMetrics: {
          period: metrics.period,
          netCents: 0,
          topCategory: null,
          topCategoryAmountCents: 0,
        },
        isEmpty: true,
      });
    }

    // Get AI story
    const story = await getAiCoachStory(metrics, { locale: 'de' });

    if (story) {
      return res.json({ story });
    }

    // If AI failed but metrics succeeded, return fallback
    return res.json({
      story: null,
      fallbackMetrics: {
        period: metrics.period,
        netCents: metrics.netCents,
        topCategory: metrics.topCategories[0]?.label || null,
        topCategoryAmountCents: metrics.topCategories[0]?.amountCents || 0,
      },
    });
  } catch (error: any) {
    console.error('[coachRoute] Error getting coach story:', error?.message || error);
    return res.status(500).json({ 
      story: null, 
      error: 'Failed to get coach story.' 
    });
  }
});

export default coachRouter;

