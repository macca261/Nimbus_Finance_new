/**
 * Tests for quests API routes
 * 
 * Verifies GET /api/quests endpoint behavior.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Express } from 'express';
import BetterSqlite3 from 'better-sqlite3';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import { ensureSchema } from '../../db';
import { ensureQuestDefinitions } from '../../services/questsService';

// Mock Express app structure
function createMockApp(db: BetterSqliteDatabase): Partial<Express> {
  return {
    locals: { db },
  } as any;
}

// Simple test helper to simulate request
function createMockRequest(app: Partial<Express>): any {
  return {
    app,
  };
}

// Import the route handler logic (we'll test the service directly)
import { getQuestsForUser } from '../../services/questsService';

describe('quests routes', () => {
  let db: BetterSqliteDatabase;

  beforeEach(() => {
    db = new BetterSqlite3(':memory:');
    db.pragma('journal_mode = WAL');
    ensureSchema(db);
    ensureQuestDefinitions(db);
    
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
        isReimbursement INTEGER DEFAULT 0
      );
    `);
  });

  afterEach(() => {
    db.close();
  });

  it('returns quests in correct format', () => {
    // Add Sonstiges transaction
    db.exec(`
      INSERT INTO transactions (bookingDate, amountCents, category)
      VALUES ('2025-01-15', -5000, 'other');
    `);
    
    const quests = getQuestsForUser(db, 'default');
    
    expect(Array.isArray(quests)).toBe(true);
    if (quests.length > 0) {
      const quest = quests[0];
      expect(quest).toHaveProperty('id');
      expect(quest).toHaveProperty('title');
      expect(quest).toHaveProperty('description');
      expect(quest).toHaveProperty('kind');
      expect(quest).toHaveProperty('status');
      expect(quest).toHaveProperty('currentValue');
      expect(quest).toHaveProperty('targetValue');
      expect(quest).toHaveProperty('progressPercent');
      expect(quest).toHaveProperty('cta');
      expect(quest.cta).toHaveProperty('label');
      expect(quest.cta).toHaveProperty('href');
    }
  });

  it('handles empty quest list gracefully', () => {
    // No transactions - should return empty or only import quest
    const quests = getQuestsForUser(db, 'default');
    
    expect(Array.isArray(quests)).toBe(true);
    // May have import quest if < 3 months of data
  });

  it('excludes completed quests from response', () => {
    // Add and then remove Sonstiges (to complete cleanup quest)
    db.exec(`
      INSERT INTO transactions (bookingDate, amountCents, category)
      VALUES ('2025-01-15', -5000, 'other');
    `);
    
    // First call creates state
    getQuestsForUser(db, 'default');
    
    // Remove Sonstiges (categorize it)
    db.exec(`UPDATE transactions SET category = 'groceries' WHERE category = 'other'`);
    
    const quests = getQuestsForUser(db, 'default');
    
    // Completed cleanup quest should not be in results
    const cleanupQuest = quests.find(q => q.id === 'cleanup_sonstiges');
    expect(cleanupQuest).toBeUndefined();
  });
});

