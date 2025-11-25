/**
 * Health Decay Calculator for City Builder Gamification
 * 
 * Implements the "Maintenance" mechanic: Goals degrade if they receive
 * no contributions for > 30 days. This leverages Loss Aversion to drive
 * consistent savings habits.
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';
import { differenceInDays } from 'date-fns';
import crypto from 'node:crypto';

export interface GoalHealthUpdate {
  goalId: string;
  oldHealth: number;
  newHealth: number;
  decayAmount: number;
  daysInactive: number;
}

/**
 * Updates health for all goals based on contribution activity
 * 
 * @param db - Database connection (better-sqlite3)
 * @param prisma - Prisma client (for Goal model)
 * @returns Array of health updates
 */
export async function updateGoalHealth(
  db: BetterSqliteDatabase,
  prisma: PrismaClient
): Promise<GoalHealthUpdate[]> {
  const goals = await prisma.goal.findMany({
    where: { isActive: true },
    select: {
      id: true,
      lastContributionTs: true,
      buildingHealth: true,
    },
  });

  const updates: GoalHealthUpdate[] = [];
  const today = new Date();

  for (const goal of goals) {
    const lastContrib = goal.lastContributionTs ? new Date(goal.lastContributionTs) : null;
    const daysInactive = lastContrib ? differenceInDays(today, lastContrib) : 999;

    let newHealth = goal.buildingHealth ?? 100;
    let decayAmount = 0;

    if (daysInactive > 30) {
      // Negative Reinforcement: Decay
      // -1 HP per week overdue (after 30 day grace period)
      const weeksOverdue = Math.floor((daysInactive - 30) / 7);
      decayAmount = -weeksOverdue;
      newHealth = Math.max(0, (goal.buildingHealth ?? 100) + decayAmount);
    } else {
      // Positive Reinforcement: Repair (if health < 100 and recent activity)
      if (daysInactive <= 7 && (goal.buildingHealth ?? 100) < 100) {
        newHealth = 100; // Instant repair on recent save
        decayAmount = 100 - (goal.buildingHealth ?? 100);
      }
    }

    if (newHealth !== (goal.buildingHealth ?? 100)) {
      await prisma.goal.update({
        where: { id: goal.id },
        data: { buildingHealth: newHealth },
      });

      // Log gamification event
      if (decayAmount !== 0) {
        const eventType = decayAmount < 0 ? 'DECAY' : 'REPAIR';
        db.prepare(`
          INSERT INTO gamification_log (id, goal_id, event_type, change_amount, timestamp)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          crypto.randomUUID(),
          goal.id,
          eventType,
          decayAmount
        );
      }

      updates.push({
        goalId: goal.id,
        oldHealth: goal.buildingHealth ?? 100,
        newHealth,
        decayAmount,
        daysInactive,
      });
    }
  }

  return updates;
}

/**
 * Records a contribution to a goal (updates lastContributionTs and repairs health)
 */
export async function recordGoalContribution(
  prisma: PrismaClient,
  db: BetterSqliteDatabase,
  goalId: string,
  amountCents: number
): Promise<void> {
  const now = new Date();
  
  await prisma.goal.update({
    where: { id: goalId },
    data: {
      lastContributionTs: now,
      buildingHealth: 100, // Instant repair on any contribution
    },
  });

  // Log construction event
  db.prepare(`
    INSERT INTO gamification_log (id, goal_id, event_type, change_amount, timestamp)
    VALUES (?, ?, 'CONSTRUCT', ?, CURRENT_TIMESTAMP)
  `).run(
    crypto.randomUUID(),
    goalId,
    amountCents
  );
}

