/**
 * Quest Service
 * 
 * Generates "quest" suggestions based on user data to gamify the Nimbus experience.
 * Quests are actionable tasks that guide users toward better financial organization.
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';
import { getAiConfig } from '../config/ai';
import axios from 'axios';

const prisma = new PrismaClient();

export type QuestKind =
  | 'clean_sonstiges'
  | 'create_budget'
  | 'create_goal'
  | 'import_more'
  | 'complete_achievement';

export interface Quest {
  id: string;
  kind: QuestKind;
  title: string;
  description: string; // Max 120 chars
  progressCurrent?: number;
  progressTarget?: number;
  ctaPath: string;
  aiText?: string; // Optional AI-polished text
}

/**
 * Check if user has uncategorized "Sonstiges" transactions
 */
async function checkSonstigesQuest(
  db: BetterSqliteDatabase,
  userId: string = 'default',
): Promise<Quest | null> {
  try {
    // Count transactions with category 'other' or null, excluding internal transfers
    const row = db
      .prepare(
        `SELECT COUNT(*) as count
         FROM transactions
         WHERE (category IS NULL OR category = 'other' OR category = 'other_review')
           AND (isInternalTransfer = 0 OR isInternalTransfer IS NULL)
           AND (isPassThrough = 0 OR isPassThrough IS NULL)
           AND (isCashWithdrawal = 0 OR isCashWithdrawal IS NULL)
           AND (isReimbursement = 0 OR isReimbursement IS NULL)
           AND amountCents < 0
         LIMIT 100`,
      )
      .get() as { count: number } | undefined;

    const count = row?.count ?? 0;

    if (count === 0) {
      return null; // No Sonstiges transactions, no quest
    }

    // Suggest quest if there are uncategorized transactions
    return {
      id: 'quest_clean_sonstiges',
      kind: 'clean_sonstiges',
      title: 'Räume Sonstiges auf',
      description: count === 1
        ? '1 Buchung wartet auf Kategorisierung.'
        : `${count} Buchungen warten auf Kategorisierung.`,
      progressCurrent: 0,
      progressTarget: count,
      ctaPath: '/review?focus=sonstiges',
    };
  } catch (error) {
    console.error('[questService] Error checking Sonstiges quest:', error);
    return null;
  }
}

/**
 * Check if user has no active budgets
 */
async function checkBudgetQuest(userId: string = 'default'): Promise<Quest | null> {
  try {
    const budgets = await prisma.budget.findMany({
      where: {
        period: 'monthly', // Check for monthly budgets (most common)
      },
      take: 1,
    });

    if (budgets.length > 0) {
      return null; // User has budgets, no quest needed
    }

    return {
      id: 'quest_create_budget',
      kind: 'create_budget',
      title: 'Erstelle dein erstes Budget',
      description: 'Plane deine Ausgaben und behalte den Überblick.',
      ctaPath: '/budgets',
    };
  } catch (error) {
    console.error('[questService] Error checking budget quest:', error);
    return null;
  }
}

/**
 * Check if user has no active goals
 */
async function checkGoalQuest(userId: string = 'default'): Promise<Quest | null> {
  try {
    const goals = await prisma.goal.findMany({
      where: {
        isActive: true,
      },
      take: 1,
    });

    if (goals.length > 0) {
      return null; // User has goals, no quest needed
    }

    return {
      id: 'quest_create_goal',
      kind: 'create_goal',
      title: 'Setze dir ein Sparziel',
      description: 'Definiere ein Ziel und verfolge deinen Fortschritt.',
      ctaPath: '/goals',
    };
  } catch (error) {
    console.error('[questService] Error checking goal quest:', error);
    return null;
  }
}

/**
 * Check if user has only imported data once (suggests importing more)
 */
async function checkImportQuest(
  db: BetterSqliteDatabase,
  userId: string = 'default',
): Promise<Quest | null> {
  try {
    // Count distinct source profiles (each import typically creates a new profile)
    const row = db
      .prepare(
        `SELECT COUNT(DISTINCT sourceProfile) as count
         FROM transactions
         WHERE sourceProfile IS NOT NULL AND sourceProfile != ''`,
      )
      .get() as { count: number } | undefined;

    const importCount = row?.count ?? 0;

    // Only suggest if user has imported once (suggest importing more months)
    if (importCount <= 1) {
      return {
        id: 'quest_import_more',
        kind: 'import_more',
        title: 'Importiere mehr Daten',
        description: 'Lade weitere Buchungen hoch für bessere Analysen.',
        ctaPath: '/imports',
      };
    }

    return null;
  } catch (error) {
    console.error('[questService] Error checking import quest:', error);
    return null;
  }
}

/**
 * Check for achievements close to completion
 */
async function checkAchievementQuest(
  db: BetterSqliteDatabase,
  userId: string = 'default',
): Promise<Quest | null> {
  try {
    // Get user achievements
    const userAchievements = await prisma.userAchievement.findMany({
      where: { userId },
      include: {
        achievement: true,
      },
    });

    // Look for achievements that are in_progress and close to completion
    for (const ua of userAchievements) {
      if (ua.status === 'in_progress' && ua.achievement) {
        // Check if progress is >= 80% (close to completion)
        const progressPercent = ua.progress / (ua.achievement.targetValue || 1);
        if (progressPercent >= 0.8 && progressPercent < 1.0) {
          const remaining = Math.ceil((ua.achievement.targetValue || 1) - ua.progress);
          return {
            id: `quest_achievement_${ua.achievement.key}`,
            kind: 'complete_achievement',
            title: `Abschluss: ${ua.achievement.title}`,
            description:
              remaining === 1
                ? 'Nur noch 1 Schritt bis zum Abschluss!'
                : `Nur noch ${remaining} Schritte bis zum Abschluss!`,
            progressCurrent: ua.progress,
            progressTarget: ua.achievement.targetValue || 1,
            ctaPath: '/achievements',
          };
        }
      }
    }

    return null;
  } catch (error) {
    console.error('[questService] Error checking achievement quest:', error);
    return null;
  }
}

/**
 * Polish quest text using AI (optional, degrades gracefully)
 */
async function polishQuestText(quest: Quest): Promise<Quest> {
  const config = getAiConfig();
  const aiQuestEnabled = process.env.AI_QUEST_ENABLED?.toLowerCase() === 'true' || process.env.AI_QUEST_ENABLED === '1';

  if (!config.enabled || !config.apiKey || !aiQuestEnabled) {
    return quest; // Return unchanged if AI is disabled
  }

  try {
    const prompt = `Du bist ein freundlicher Finanz-Coach. Formuliere diesen Quest-Text kurz und motivierend auf Deutsch (max. 120 Zeichen für die Beschreibung):

Titel: ${quest.title}
Beschreibung: ${quest.description}
${quest.progressCurrent !== undefined && quest.progressTarget !== undefined
  ? `Fortschritt: ${quest.progressCurrent} / ${quest.progressTarget}`
  : ''}

Antworte nur mit einem JSON-Objekt im Format:
{
  "title": "Kurzer, motivierender Titel (max. 40 Zeichen)",
  "description": "Kurze, motivierende Beschreibung (max. 120 Zeichen)"
}`;

    const response = await axios.post(
      config.provider === 'openai'
        ? 'https://api.openai.com/v1/chat/completions'
        : 'https://api.anthropic.com/v1/messages',
      config.provider === 'openai'
        ? {
            model: config.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 200,
          }
        : {
            model: config.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 200,
          },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
          ...(config.provider === 'anthropic' ? { 'anthropic-version': '2023-06-01' } : {}),
        },
        timeout: 5000, // 5 second timeout
      },
    );

    const content =
      config.provider === 'openai'
        ? response.data.choices[0]?.message?.content
        : response.data.content?.[0]?.text;

    if (content) {
      // Try to parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.title && parsed.description) {
          return {
            ...quest,
            title: parsed.title.substring(0, 40), // Enforce length limit
            description: parsed.description.substring(0, 120), // Enforce length limit
            aiText: content, // Store original AI response for debugging
          };
        }
      }
    }
  } catch (error) {
    // Degrade gracefully - log but don't fail
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[questService] AI polishing failed, using static text:', error);
    }
  }

  return quest; // Return unchanged on error
}

/**
 * Get active quests for a user (0-3 quests)
 * Priority order:
 * 1. Sonstiges cleanup (if applicable)
 * 2. Budget creation (if no budgets)
 * 3. Goal creation (if no goals)
 * 4. Import more (if only one import)
 * 5. Achievement completion (if close)
 */
export async function getActiveQuests(
  db: BetterSqliteDatabase,
  userId: string = 'default',
  options?: { useAi?: boolean },
): Promise<Quest[]> {
  const quests: Quest[] = [];
  const useAi = options?.useAi ?? false;

  try {
    // Priority 1: Sonstiges cleanup
    const sonstigesQuest = await checkSonstigesQuest(db, userId);
    if (sonstigesQuest) {
      quests.push(useAi ? await polishQuestText(sonstigesQuest) : sonstigesQuest);
      if (quests.length >= 3) return quests; // Max 3 quests
    }

    // Priority 2: Budget creation
    const budgetQuest = await checkBudgetQuest(userId);
    if (budgetQuest) {
      quests.push(useAi ? await polishQuestText(budgetQuest) : budgetQuest);
      if (quests.length >= 3) return quests;
    }

    // Priority 3: Goal creation
    const goalQuest = await checkGoalQuest(userId);
    if (goalQuest) {
      quests.push(useAi ? await polishQuestText(goalQuest) : goalQuest);
      if (quests.length >= 3) return quests;
    }

    // Priority 4: Import more
    const importQuest = await checkImportQuest(db, userId);
    if (importQuest) {
      quests.push(useAi ? await polishQuestText(importQuest) : importQuest);
      if (quests.length >= 3) return quests;
    }

    // Priority 5: Achievement completion
    const achievementQuest = await checkAchievementQuest(db, userId);
    if (achievementQuest) {
      quests.push(useAi ? await polishQuestText(achievementQuest) : achievementQuest);
      if (quests.length >= 3) return quests;
    }

    return quests;
  } catch (error) {
    console.error('[questService] Error getting active quests:', error);
    return []; // Return empty array on error
  }
}

