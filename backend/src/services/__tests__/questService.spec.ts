/**
 * Tests for questService
 * 
 * Verifies quest selection logic based on user data conditions.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';

// Mock Prisma using hoisted functions
const mockBudgetFindMany = vi.hoisted(() => vi.fn());
const mockGoalFindMany = vi.hoisted(() => vi.fn());
const mockUserAchievementFindMany = vi.hoisted(() => vi.fn());

vi.mock('@prisma/client', () => {
  return {
    PrismaClient: vi.fn().mockImplementation(() => ({
      budget: {
        findMany: mockBudgetFindMany,
      },
      goal: {
        findMany: mockGoalFindMany,
      },
      userAchievement: {
        findMany: mockUserAchievementFindMany,
      },
    })),
  };
});

// Import after mocking
import { getActiveQuests } from '../questService';

describe('questService', () => {
  let db: BetterSqliteDatabase;
  const userId = 'default';

  beforeEach(() => {
    // Create in-memory database for each test
    db = new BetterSqlite3(':memory:');
    
    // Create transactions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bookingDate TEXT NOT NULL,
        amountCents INTEGER NOT NULL,
        category TEXT,
        isInternalTransfer INTEGER DEFAULT 0,
        isPassThrough INTEGER DEFAULT 0,
        isCashWithdrawal INTEGER DEFAULT 0,
        isReimbursement INTEGER DEFAULT 0,
        sourceProfile TEXT
      );
    `);

    // Reset Prisma mocks
    mockBudgetFindMany.mockReset();
    mockGoalFindMany.mockReset();
    mockUserAchievementFindMany.mockReset();
  });

  afterEach(() => {
    db.close();
    vi.clearAllMocks();
  });

  it('returns Sonstiges cleanup quest when uncategorized transactions exist', async () => {
    // Insert uncategorized transaction
    db.exec(`
      INSERT INTO transactions (bookingDate, amountCents, category)
      VALUES ('2025-01-15', -5000, 'other');
    `);

    const quests = await getActiveQuests(db, userId, { useAi: false });

    expect(quests.length).toBeGreaterThan(0);
    const sonstigesQuest = quests.find(q => q.kind === 'clean_sonstiges');
    expect(sonstigesQuest).toBeDefined();
    expect(sonstigesQuest?.title).toBe('Räume Sonstiges auf');
    expect(sonstigesQuest?.ctaPath).toBe('/review?focus=sonstiges');
    expect(sonstigesQuest?.progressCurrent).toBe(0);
    expect(sonstigesQuest?.progressTarget).toBe(1);
  });

  it('does not return Sonstiges quest when no uncategorized transactions exist', async () => {
    // Insert categorized transaction
    db.exec(`
      INSERT INTO transactions (bookingDate, amountCents, category)
      VALUES ('2025-01-15', -5000, 'groceries');
    `);

    const quests = await getActiveQuests(db, userId, { useAi: false });

    const sonstigesQuest = quests.find(q => q.kind === 'clean_sonstiges');
    expect(sonstigesQuest).toBeUndefined();
  });

  it('returns budget creation quest when no budgets exist', async () => {
    mockBudgetFindMany.mockResolvedValue([]);
    mockGoalFindMany.mockResolvedValue([]);
    mockUserAchievementFindMany.mockResolvedValue([]);

    // No uncategorized transactions
    db.exec(`
      INSERT INTO transactions (bookingDate, amountCents, category)
      VALUES ('2025-01-15', -5000, 'groceries');
    `);

    const quests = await getActiveQuests(db, userId, { useAi: false });

    const budgetQuest = quests.find(q => q.kind === 'create_budget');
    expect(budgetQuest).toBeDefined();
    expect(budgetQuest?.title).toBe('Erstelle dein erstes Budget');
    expect(budgetQuest?.ctaPath).toBe('/budgets');
  });

  it('does not return budget quest when budgets exist', async () => {
    mockBudgetFindMany.mockResolvedValue([{ id: '1', period: 'monthly' }]);
    mockGoalFindMany.mockResolvedValue([]);
    mockUserAchievementFindMany.mockResolvedValue([]);

    const quests = await getActiveQuests(db, userId, { useAi: false });

    const budgetQuest = quests.find(q => q.kind === 'create_budget');
    expect(budgetQuest).toBeUndefined();
  });

  it('returns goal creation quest when no goals exist', async () => {
    mockBudgetFindMany.mockResolvedValue([{ id: '1', period: 'monthly' }]);
    mockGoalFindMany.mockResolvedValue([]);
    mockUserAchievementFindMany.mockResolvedValue([]);

    const quests = await getActiveQuests(db, userId, { useAi: false });

    const goalQuest = quests.find(q => q.kind === 'create_goal');
    expect(goalQuest).toBeDefined();
    expect(goalQuest?.title).toBe('Setze dir ein Sparziel');
    expect(goalQuest?.ctaPath).toBe('/goals');
  });

  it('returns import quest when only one import exists', async () => {
    mockBudgetFindMany.mockResolvedValue([{ id: '1', period: 'monthly' }]);
    mockGoalFindMany.mockResolvedValue([{ id: '1', isActive: true }]);
    mockUserAchievementFindMany.mockResolvedValue([]);

    // Only one source profile (one import)
    db.exec(`
      INSERT INTO transactions (bookingDate, amountCents, category, sourceProfile)
      VALUES ('2025-01-15', -5000, 'groceries', 'account1');
    `);

    const quests = await getActiveQuests(db, userId, { useAi: false });

    const importQuest = quests.find(q => q.kind === 'import_more');
    expect(importQuest).toBeDefined();
    expect(importQuest?.title).toBe('Importiere mehr Daten');
    expect(importQuest?.ctaPath).toBe('/imports');
  });

  it('returns 0 quests when everything is already good', async () => {
    mockBudgetFindMany.mockResolvedValue([{ id: '1', period: 'monthly' }]);
    mockGoalFindMany.mockResolvedValue([{ id: '1', isActive: true }]);
    mockUserAchievementFindMany.mockResolvedValue([]);

    // Multiple imports (more than 1)
    db.exec(`
      INSERT INTO transactions (bookingDate, amountCents, category, sourceProfile)
      VALUES 
        ('2025-01-15', -5000, 'groceries', 'account1'),
        ('2025-01-16', -3000, 'dining', 'account2');
    `);

    const quests = await getActiveQuests(db, userId, { useAi: false });

    // Should have no quests (everything is done)
    expect(quests.length).toBe(0);
  });

  it('returns max 3 quests', async () => {
    // Create conditions for multiple quests
    db.exec(`
      INSERT INTO transactions (bookingDate, amountCents, category)
      VALUES ('2025-01-15', -5000, 'other');
    `);

    mockBudgetFindMany.mockResolvedValue([]);
    mockGoalFindMany.mockResolvedValue([]);
    mockUserAchievementFindMany.mockResolvedValue([]);

    const quests = await getActiveQuests(db, userId, { useAi: false });

    // Should have at most 3 quests
    expect(quests.length).toBeLessThanOrEqual(3);
  });

  it('excludes internal transfers from Sonstiges count', async () => {
    // Insert internal transfer with category 'other'
    db.exec(`
      INSERT INTO transactions (bookingDate, amountCents, category, isInternalTransfer)
      VALUES ('2025-01-15', -5000, 'other', 1);
    `);

    const quests = await getActiveQuests(db, userId, { useAi: false });

    const sonstigesQuest = quests.find(q => q.kind === 'clean_sonstiges');
    expect(sonstigesQuest).toBeUndefined(); // Should not appear
  });
});

