/**
 * Gamification Service
 * 
 * Provides lightweight gamification features (XP, levels, ranks, streaks)
 * to make Nimbus Finance more engaging and guide users toward better financial organization.
 * 
 * This prepares Nimbus for future Pro tier features and enhanced user engagement.
 */

import type { IDatabase } from '../db/IDatabase';
import { database, rawDb } from '../db';
import { getQuestsForUser } from './questsService';

export interface GamificationSnapshot {
  xp: number;
  level: number;
  rankLabel: string; // "Bronze Budgeter", "Silver Saver", etc.
  streakDays: number;
  activeQuests: Array<{
    id: string;
    title: string;
    progressPercent: number;
  }>;
  recentlyCompletedQuests: Array<{
    id: string;
    title: string;
    completedAt: string;
  }>;
}

/**
 * Rank thresholds for XP-based progression
 */
const RANKS = [
  { minXp: 0, label: 'Bronze Budgeter' },
  { minXp: 100, label: 'Silver Saver' },
  { minXp: 250, label: 'Gold Guru' },
  { minXp: 500, label: 'Platinum Planner' },
  { minXp: 1000, label: 'Diamond Director' },
];

/**
 * Calculate level from XP (simple linear progression: 1 level per 50 XP)
 */
function calculateLevel(xp: number): number {
  return Math.floor(xp / 50) + 1;
}

/**
 * Get rank label for given XP
 */
function getRankLabel(xp: number): string {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (xp >= RANKS[i].minXp) {
      return RANKS[i].label;
    }
  }
  return RANKS[0].label;
}

/**
 * Calculate XP from completed quests and categorized transactions
 * 
 * Simple formula for v0:
 * - +10 XP per completed quest
 * - +1 XP per transaction that moved out of Sonstiges (categorized)
 * 
 * This is deterministic and can be refined later.
 */
function calculateXP(db: IDatabase, userId: string): number {
  let xp = 0;
  
  // XP from completed quests
  try {
    const completedQuests = db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM user_quest_states WHERE userId = ? AND status = 'COMPLETED'`,
      [userId]
    );
    xp += (completedQuests[0]?.count ?? 0) * 10;
  } catch {
    // Table might not exist yet
  }
  
  // XP from categorized transactions (moved out of Sonstiges)
  // Count transactions that have a category other than 'other' or 'other_review'
  try {
    const categorizedTxs = db.query<{ count: number }>(
      `SELECT COUNT(*) as count 
       FROM transactions 
       WHERE category IS NOT NULL 
         AND category != 'other' 
         AND category != 'other_review'
         AND (isInternalTransfer = 0 OR isInternalTransfer IS NULL)`,
      []
    );
    xp += (categorizedTxs[0]?.count ?? 0) * 1;
  } catch {
    // Table might not exist yet
  }
  
  return xp;
}

/**
 * Calculate streak days (simple: count distinct days with transactions in last 30 days)
 */
function calculateStreakDays(db: IDatabase, userId: string): number {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    
    const distinctDays = db.query<{ count: number }>(
      `SELECT COUNT(DISTINCT DATE(bookingDate)) as count
       FROM transactions
       WHERE bookingDate >= ?
         AND (isInternalTransfer = 0 OR isInternalTransfer IS NULL)`,
      [cutoffDateStr]
    );
    
    return distinctDays[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Get gamification snapshot for a user
 * 
 * Returns a safe default snapshot if any errors occur during calculation.
 * This ensures the frontend never crashes due to missing tables or query errors.
 */
export function getGamificationSnapshot(
  userId: string = 'default',
  db: IDatabase = database,
): GamificationSnapshot {
  // Default safe values
  const defaultSnapshot: GamificationSnapshot = {
    xp: 0,
    level: 1,
    rankLabel: 'Bronze Budgeter',
    streakDays: 0,
    activeQuests: [],
    recentlyCompletedQuests: [],
  };

  try {
    const xp = calculateXP(db, userId);
    const level = calculateLevel(xp);
    const rankLabel = getRankLabel(xp);
    const streakDays = calculateStreakDays(db, userId);
    
    // Get active and completed quests - wrap in try-catch for safety
    let activeQuests: Array<{ id: string; title: string; progressPercent: number }> = [];
    try {
      // Note: getQuestsForUser still uses BetterSqliteDatabase, so we pass rawDb
      // This will be refactored in a future update
      const quests = getQuestsForUser(userId, rawDb);
      activeQuests = quests
        .filter(q => q.status === 'ACTIVE')
        .map(q => ({
          id: q.id,
          title: q.title,
          progressPercent: q.progressPercent,
        }));
    } catch (err) {
      // Log in dev mode only
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[gamificationService] Failed to load quests:', err);
      }
      // Use empty array as fallback
      activeQuests = [];
    }
    
    // Get recently completed quests (last 7 days)
    const recentlyCompletedQuests: Array<{ id: string; title: string; completedAt: string }> = [];
    try {
      const completedQuests = db.query<{
        questId: string;
        completedAt: string;
        title: string;
      }>(
        `SELECT uqs.questId, uqs.completedAt, qd.title
         FROM user_quest_states uqs
         JOIN quest_definitions qd ON uqs.questId = qd.id
         WHERE uqs.userId = ? 
           AND uqs.status = 'COMPLETED'
           AND uqs.completedAt >= datetime('now', '-7 days')
         ORDER BY uqs.completedAt DESC
         LIMIT 5`,
        [userId]
      );
      
      for (const q of completedQuests) {
        recentlyCompletedQuests.push({
          id: q.questId,
          title: q.title,
          completedAt: q.completedAt,
        });
      }
    } catch (err) {
      // Tables might not exist yet - this is fine, just use empty array
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[gamificationService] Failed to load completed quests:', err);
      }
    }
    
    return {
      xp,
      level,
      rankLabel,
      streakDays,
      activeQuests,
      recentlyCompletedQuests,
    };
  } catch (err) {
    // Log error in dev mode
    if (process.env.NODE_ENV !== 'production') {
      console.error('[gamificationService] getGamificationSnapshot failed:', err);
    }
    
    // Return safe default instead of throwing
    return defaultSnapshot;
  }
}

