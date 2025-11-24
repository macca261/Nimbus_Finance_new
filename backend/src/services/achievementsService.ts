import { PrismaClient } from '@prisma/client';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';

const prisma = new PrismaClient();

export type AchievementStatus = 'locked' | 'in_progress' | 'completed';

export interface UserAchievementWithDetails {
  id: string;
  userId: string;
  achievementId: string;
  status: AchievementStatus;
  progress: number;
  unlockedAt: Date | null;
  lastUpdatedAt: Date;
  achievement: {
    id: string;
    key: string;
    title: string;
    description: string;
    type: string;
  };
}

/**
 * Get all achievements for a user with their current status
 * If no UserAchievement records exist, returns all Achievement definitions with locked status
 */
export async function getAchievementsForUser(
  userId: string = 'default'
): Promise<UserAchievementWithDetails[]> {
  // Get all achievement definitions
  const allAchievements = await prisma.achievement.findMany({
    orderBy: { type: 'asc' },
  });

  // Get existing user achievements
  const userAchievements = await prisma.userAchievement.findMany({
    where: { userId },
    include: {
      achievement: true,
    },
  });

  const userAchievementMap = new Map(
    userAchievements.map(ua => [ua.achievementId, ua])
  );

  // Return all achievements, using existing UserAchievement if available, otherwise default to locked
  return allAchievements.map((achievement) => {
    const userAchievement = userAchievementMap.get(achievement.id);
    if (userAchievement) {
      return {
        id: userAchievement.id,
        userId: userAchievement.userId,
        achievementId: userAchievement.achievementId,
        status: userAchievement.status as AchievementStatus,
        progress: userAchievement.progress,
        unlockedAt: userAchievement.unlockedAt,
        lastUpdatedAt: userAchievement.lastUpdatedAt,
        achievement: {
          id: achievement.id,
          key: achievement.key,
          title: achievement.title,
          description: achievement.description,
          type: achievement.type,
        },
      };
    }
    // Default locked state for achievements without UserAchievement record
    return {
      id: `default-${achievement.id}`,
      userId,
      achievementId: achievement.id,
      status: 'locked' as AchievementStatus,
      progress: 0,
      unlockedAt: null,
      lastUpdatedAt: new Date(),
      achievement: {
        id: achievement.id,
        key: achievement.key,
        title: achievement.title,
        description: achievement.description,
        type: achievement.type,
      },
    };
  });
}

/**
 * Evaluate all achievements for a user based on current data
 */
export async function evaluateAchievements(
  userId: string = 'default',
  db: BetterSqliteDatabase
): Promise<UserAchievementWithDetails[]> {
  // Get all achievement definitions
  const achievements = await prisma.achievement.findMany({
    orderBy: { type: 'asc' },
  });

  const results: UserAchievementWithDetails[] = [];

  for (const achievement of achievements) {
    const evaluation = await evaluateSingleAchievement(achievement.key, db);
    
    // Upsert user achievement
    const userAchievement = await prisma.userAchievement.upsert({
      where: {
        userId_achievementId: {
          userId,
          achievementId: achievement.id,
        },
      },
      create: {
        userId,
        achievementId: achievement.id,
        status: evaluation.status,
        progress: evaluation.progress,
        unlockedAt: evaluation.status === 'completed' ? new Date() : null,
        lastUpdatedAt: new Date(),
      },
      update: {
        status: evaluation.status,
        progress: evaluation.progress,
        unlockedAt: evaluation.status === 'completed' && evaluation.progress === 100 
          ? (await prisma.userAchievement.findUnique({
              where: { userId_achievementId: { userId, achievementId: achievement.id } }
            }))?.unlockedAt ?? new Date()
          : evaluation.status === 'completed' ? new Date() : null,
        lastUpdatedAt: new Date(),
      },
    });

    results.push({
      id: userAchievement.id,
      userId: userAchievement.userId,
      achievementId: userAchievement.achievementId,
      status: userAchievement.status as AchievementStatus,
      progress: userAchievement.progress,
      unlockedAt: userAchievement.unlockedAt,
      lastUpdatedAt: userAchievement.lastUpdatedAt,
      achievement: {
        id: achievement.id,
        key: achievement.key,
        title: achievement.title,
        description: achievement.description,
        type: achievement.type,
      },
    });
  }

  return results;
}

/**
 * Evaluate a single achievement by key
 */
async function evaluateSingleAchievement(
  key: string,
  db: BetterSqliteDatabase
): Promise<{ status: AchievementStatus; progress: number }> {
  switch (key) {
    case 'first_import': {
      const count = (db.prepare(`SELECT COUNT(1) AS c FROM transactions`).get() as { c: number })?.c ?? 0;
      const isCompleted = count > 0;
      return {
        status: isCompleted ? 'completed' : 'locked',
        progress: isCompleted ? 100 : 0,
      };
    }

    case 'transactions_50': {
      const count = (db.prepare(`SELECT COUNT(1) AS c FROM transactions`).get() as { c: number })?.c ?? 0;
      const isCompleted = count >= 50;
      const progress = Math.min(100, Math.round((count / 50) * 100));
      return {
        status: isCompleted ? 'completed' : count > 0 ? 'in_progress' : 'locked',
        progress,
      };
    }

    case 'transactions_500': {
      const count = (db.prepare(`SELECT COUNT(1) AS c FROM transactions`).get() as { c: number })?.c ?? 0;
      const isCompleted = count >= 500;
      const progress = Math.min(100, Math.round((count / 500) * 100));
      return {
        status: isCompleted ? 'completed' : count >= 50 ? 'in_progress' : 'locked',
        progress,
      };
    }

    case 'streak_7': {
      // Compute longest consecutive days with >=1 tx/day in last 60 days
      const days = db.prepare(`
        SELECT bookingDate AS d, COUNT(1) AS c
        FROM transactions
        WHERE bookingDate >= date('now','-60 day')
        GROUP BY bookingDate
        ORDER BY d ASC
      `).all() as { d: string; c: number }[];
      
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
      
      const isCompleted = longest >= 7;
      const progress = Math.min(100, Math.round((longest / 7) * 100));
      return {
        status: isCompleted ? 'completed' : longest > 0 ? 'in_progress' : 'locked',
        progress,
      };
    }

    case 'streak_30': {
      const days = db.prepare(`
        SELECT bookingDate AS d, COUNT(1) AS c
        FROM transactions
        WHERE bookingDate >= date('now','-90 day')
        GROUP BY bookingDate
        ORDER BY d ASC
      `).all() as { d: string; c: number }[];
      
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
      
      const isCompleted = longest >= 30;
      const progress = Math.min(100, Math.round((longest / 30) * 100));
      return {
        status: isCompleted ? 'completed' : longest >= 7 ? 'in_progress' : 'locked',
        progress,
      };
    }

    case 'first_budget': {
      const count = await prisma.budget.count();
      const isCompleted = count > 0;
      return {
        status: isCompleted ? 'completed' : 'locked',
        progress: isCompleted ? 100 : 0,
      };
    }

    case 'budget_3_months': {
      // Check if user has budgets for 3 consecutive months
      const budgets = await prisma.budget.findMany({
        where: { period: 'monthly' },
        orderBy: { periodValue: 'asc' },
      });
      
      // Group by periodValue and check for 3 consecutive months
      const months = new Set(budgets.map(b => b.periodValue));
      const sortedMonths = Array.from(months).sort();
      
      let consecutiveCount = 0;
      let maxConsecutive = 0;
      let prevMonth: string | null = null;
      
      for (const month of sortedMonths) {
        if (!prevMonth) {
          consecutiveCount = 1;
        } else {
          const [prevYear, prevM] = prevMonth.split('-').map(Number);
          const [currYear, currM] = month.split('-').map(Number);
          const expectedNext = new Date(Date.UTC(prevYear, prevM - 1));
          expectedNext.setUTCMonth(expectedNext.getUTCMonth() + 1);
          const expectedStr = `${expectedNext.getUTCFullYear()}-${String(expectedNext.getUTCMonth() + 1).padStart(2, '0')}`;
          
          if (month === expectedStr) {
            consecutiveCount++;
          } else {
            maxConsecutive = Math.max(maxConsecutive, consecutiveCount);
            consecutiveCount = 1;
          }
        }
        prevMonth = month;
      }
      maxConsecutive = Math.max(maxConsecutive, consecutiveCount);
      
      const isCompleted = maxConsecutive >= 3;
      const progress = Math.min(100, Math.round((maxConsecutive / 3) * 100));
      return {
        status: isCompleted ? 'completed' : maxConsecutive > 0 ? 'in_progress' : 'locked',
        progress,
      };
    }

    case 'first_goal': {
      const count = await prisma.goal.count();
      const isCompleted = count > 0;
      return {
        status: isCompleted ? 'completed' : 'locked',
        progress: isCompleted ? 100 : 0,
      };
    }

    case 'goals_5_progress_50': {
      const goals = await prisma.goal.findMany({
        where: { isActive: true },
      });
      
      // Count goals with progress >= 50%
      const goalsWithProgress = goals.filter(g => {
        const progress = g.currentCents / g.targetCents;
        return progress >= 0.5;
      });
      
      const isCompleted = goalsWithProgress.length >= 5;
      const progress = Math.min(100, Math.round((goalsWithProgress.length / 5) * 100));
      return {
        status: isCompleted ? 'completed' : goalsWithProgress.length > 0 ? 'in_progress' : 'locked',
        progress,
      };
    }

    case 'reimbursements_10': {
      // Count transactions that are likely reimbursements (negative amounts with specific patterns)
      // This is a simplified check - in a real app, you'd have a reimbursement flag
      const count = (db.prepare(`
        SELECT COUNT(1) AS c
        FROM transactions
        WHERE amountCents < 0
          AND (purpose LIKE '%erstatt%' OR purpose LIKE '%refund%' OR purpose LIKE '%rückzahl%')
      `).get() as { c: number })?.c ?? 0;
      
      const isCompleted = count >= 10;
      const progress = Math.min(100, Math.round((count / 10) * 100));
      return {
        status: isCompleted ? 'completed' : count > 0 ? 'in_progress' : 'locked',
        progress,
      };
    }

    case 'monthly_saver_500': {
      // Get latest month
      const latestMonth = (db.prepare(`
        SELECT strftime('%Y-%m', MAX(bookingDate)) AS ym
        FROM transactions
      `).get() as { ym?: string })?.ym;
      
      if (!latestMonth) {
        return { status: 'locked', progress: 0 };
      }
      
      const net = db.prepare(`
        SELECT 
          COALESCE((SELECT SUM(amountCents) FROM transactions WHERE amountCents>0 AND strftime('%Y-%m', bookingDate)=?),0) -
          ABS(COALESCE((SELECT SUM(amountCents) FROM transactions WHERE amountCents<0 AND strftime('%Y-%m', bookingDate)=?),0)) AS net
      `).get(latestMonth, latestMonth) as { net: number };
      
      const netCents = net?.net ?? 0;
      const isCompleted = netCents >= 50000; // 500 EUR in cents
      const progress = Math.min(100, Math.round((netCents / 50000) * 100));
      return {
        status: isCompleted ? 'completed' : netCents > 0 ? 'in_progress' : 'locked',
        progress,
      };
    }

    default:
      return { status: 'locked', progress: 0 };
  }
}

