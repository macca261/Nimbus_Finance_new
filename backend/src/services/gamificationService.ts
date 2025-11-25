/**
 * Gamification Service
 * 
 * Provides unified gamification features (XP, ranks, streaks, quests) to make
 * Nimbus Finance more engaging and guide users toward better financial organization.
 * 
 * **XP Calculation Rules (v1):**
 * - Each completed achievement = 50 XP
 * - Each completed quest = 30 XP
 * 
 * **Rank Thresholds:**
 * - Bronze: < 200 XP
 * - Silver: 200-499 XP
 * - Gold: 500-999 XP
 * - Platinum: >= 1000 XP
 * 
 * **Streak Calculation:**
 * - Uses existing streak achievements (streak_7, streak_30) logic
 * - Computes longest consecutive days with transactions in last 60 days
 * - Current streak = longest streak ending today (if today has activity)
 * 
 * All values are approximations for v1 and can be refined later.
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import { getAchievementsForUser } from './achievementsService';
import { getQuestsForUser, getUserQuestStates } from './questsService';
import { rawDb } from '../db';

export interface GamificationSummary {
  rank: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  xp: number;              // current XP in this rank
  xpToNext: number;        // XP needed to reach next rank
  level: number;           // optional numeric level
  currentStreakDays: number;
  longestStreakDays: number;
  completedQuestsThisWeek: number;
  achievementsCompleted: number;
  nextSuggestedQuest?: {
    id: string;
    title: string;
    ctaLabel: string;
    ctaPath: string;
  } | null;
}

/**
 * Rank thresholds for XP-based progression
 */
const RANK_THRESHOLDS = [
  { minXp: 0, rank: 'Bronze' as const },
  { minXp: 200, rank: 'Silver' as const },
  { minXp: 500, rank: 'Gold' as const },
  { minXp: 1000, rank: 'Platinum' as const },
];

/**
 * Calculate rank from XP
 */
function calculateRank(xp: number): 'Bronze' | 'Silver' | 'Gold' | 'Platinum' {
  for (let i = RANK_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= RANK_THRESHOLDS[i].minXp) {
      return RANK_THRESHOLDS[i].rank;
    }
  }
  return 'Bronze';
}

/**
 * Calculate XP needed to reach next rank
 */
function calculateXpToNext(xp: number): number {
  const currentRank = calculateRank(xp);
  const currentIndex = RANK_THRESHOLDS.findIndex(r => r.rank === currentRank);
  
  // If at top rank, return 0
  if (currentIndex === RANK_THRESHOLDS.length - 1) {
    return 0;
  }
  
  const nextThreshold = RANK_THRESHOLDS[currentIndex + 1].minXp;
  return Math.max(0, nextThreshold - xp);
}

/**
 * Calculate level from XP (simple linear: 1 level per 50 XP)
 */
function calculateLevel(xp: number): number {
  return Math.floor(xp / 50) + 1;
}

/**
 * Calculate XP from achievements and quests
 */
async function calculateXP(
  userId: string = 'default',
  db: BetterSqliteDatabase = rawDb,
): Promise<number> {
  let xp = 0;
  
  try {
    // XP from completed achievements (50 XP each)
    const achievements = await getAchievementsForUser(userId);
    const completedAchievements = achievements.filter(a => a.status === 'completed');
    xp += completedAchievements.length * 50;
  } catch (err) {
    // Log in dev mode only
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[gamificationService] Failed to load achievements for XP calculation:', err);
    }
  }
  
  try {
    // XP from completed quests (30 XP each)
    const questStates = getUserQuestStates(db, userId);
    const completedQuests = questStates.filter(q => q.status === 'COMPLETED');
    xp += completedQuests.length * 30;
  } catch (err) {
    // Log in dev mode only
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[gamificationService] Failed to load quests for XP calculation:', err);
    }
  }
  
  return xp;
}

/**
 * Calculate streak days using existing streak achievement logic
 * 
 * Computes longest consecutive days with transactions in last 60 days.
 * Current streak = longest streak ending today (if today has activity).
 */
function calculateStreakDays(
  db: BetterSqliteDatabase,
  userId: string = 'default',
): { current: number; longest: number } {
  try {
    // Get all days with transactions in last 60 days
    const days = db.prepare(`
      SELECT DATE(bookingDate) AS d, COUNT(1) AS c
      FROM transactions
      WHERE bookingDate >= date('now','-60 day')
        AND (isInternalTransfer = 0 OR isInternalTransfer IS NULL)
      GROUP BY DATE(bookingDate)
      ORDER BY d ASC
    `).all() as Array<{ d: string; c: number }>;
    
    if (days.length === 0) {
      return { current: 0, longest: 0 };
    }
    
    // Calculate longest streak
    let longest = 0;
    let current = 0;
    let prev: string | null = null;
    
    for (const r of days) {
      if (!prev) {
        current = 1;
      } else {
        const next = new Date(prev);
        next.setDate(next.getDate() + 1);
        const expect = next.toISOString().slice(0, 10);
        current = r.d === expect ? current + 1 : 1;
      }
      if (current > longest) longest = current;
      prev = r.d;
    }
    
    // Current streak = longest streak ending today (if today has activity)
    const today = new Date().toISOString().slice(0, 10);
    const hasToday = days.some(d => d.d === today);
    
    // For current streak, check if today is part of the streak
    let currentStreak = 0;
    if (hasToday) {
      // Walk backwards from today to find consecutive days
      const sortedDays = days.map(d => d.d).sort().reverse();
      let streakCount = 0;
      let expectedDate = today;
      
      for (const day of sortedDays) {
        if (day === expectedDate) {
          streakCount++;
          const prevDate = new Date(expectedDate);
          prevDate.setDate(prevDate.getDate() - 1);
          expectedDate = prevDate.toISOString().slice(0, 10);
        } else {
          break;
        }
      }
      currentStreak = streakCount;
    }
    
    return {
      current: currentStreak,
      longest: longest,
    };
  } catch (err) {
    // Log in dev mode only
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[gamificationService] Failed to calculate streak:', err);
    }
    return { current: 0, longest: 0 };
  }
}

/**
 * Count completed quests this week
 */
function countCompletedQuestsThisWeek(
  db: BetterSqliteDatabase,
  userId: string = 'default',
): number {
  try {
    const questStates = getUserQuestStates(db, userId);
    const completedThisWeek = questStates.filter(q => {
      if (q.status !== 'COMPLETED' || !q.completedAt) return false;
      
      const completedDate = new Date(q.completedAt);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      return completedDate >= weekAgo;
    });
    
    return completedThisWeek.length;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[gamificationService] Failed to count completed quests:', err);
    }
    return 0;
  }
}

/**
 * Get next suggested quest (first active but not completed quest)
 */
function getNextSuggestedQuest(
  db: BetterSqliteDatabase,
  userId: string = 'default',
): GamificationSummary['nextSuggestedQuest'] {
  try {
    const quests = getQuestsForUser(db, userId);
    
    // Find first ACTIVE quest (not completed)
    const activeQuest = quests.find(q => q.status === 'ACTIVE');
    
    if (!activeQuest) {
      return null;
    }
    
    return {
      id: activeQuest.id,
      title: activeQuest.title,
      ctaLabel: activeQuest.cta.label,
      ctaPath: activeQuest.cta.href,
    };
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[gamificationService] Failed to get next suggested quest:', err);
    }
    return null;
  }
}

/**
 * Get gamification summary for a user
 * 
 * Returns a safe default summary if any errors occur during calculation.
 * This ensures the frontend never crashes due to missing tables or query errors.
 */
export async function getGamificationSummary(
  userId: string = 'default',
  db: BetterSqliteDatabase = rawDb,
): Promise<GamificationSummary> {
  // Default safe values
  const defaultSummary: GamificationSummary = {
    rank: 'Bronze',
    xp: 0,
    xpToNext: 200,
    level: 1,
    currentStreakDays: 0,
    longestStreakDays: 0,
    completedQuestsThisWeek: 0,
    achievementsCompleted: 0,
    nextSuggestedQuest: null,
  };

  try {
    // Calculate XP
    const xp = await calculateXP(userId, db);
    
    // Calculate rank and XP to next
    const rank = calculateRank(xp);
    const xpToNext = calculateXpToNext(xp);
    const level = calculateLevel(xp);
    
    // Calculate streaks
    const streaks = calculateStreakDays(db, userId);
    
    // Count completed quests this week
    const completedQuestsThisWeek = countCompletedQuestsThisWeek(db, userId);
    
    // Count completed achievements
    let achievementsCompleted = 0;
    try {
      const achievements = await getAchievementsForUser(userId);
      achievementsCompleted = achievements.filter(a => a.status === 'completed').length;
    } catch (err) {
      // Log in dev mode only
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[gamificationService] Failed to count achievements:', err);
      }
    }
    
    // Get next suggested quest
    const nextSuggestedQuest = getNextSuggestedQuest(db, userId);
    
    return {
      rank,
      xp,
      xpToNext,
      level,
      currentStreakDays: streaks.current,
      longestStreakDays: streaks.longest,
      completedQuestsThisWeek,
      achievementsCompleted,
      nextSuggestedQuest,
    };
  } catch (err) {
    // Log error in dev mode
    if (process.env.NODE_ENV !== 'production') {
      console.error('[gamificationService] getGamificationSummary failed:', err);
    }
    
    // Return safe default instead of throwing
    return defaultSummary;
  }
}
