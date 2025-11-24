/**
 * Tests for questsService (Quest Engine v0)
 * 
 * Verifies quest definition management, progress calculation, and status transitions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import {
  getActiveQuestDefinitions,
  ensureQuestDefinitions,
  getUserQuestStates,
  getQuestsForUser,
} from '../questsService';
import { ensureSchema } from '../../db';

describe('questsService', () => {
  let db: BetterSqliteDatabase;
  const userId = 'default';

  beforeEach(() => {
    // Create in-memory database for each test
    db = new BetterSqlite3(':memory:');
    db.pragma('journal_mode = WAL');
    
    // Ensure schema (creates quest tables)
    ensureSchema(db);
    
    // Create transactions table (simplified for tests)
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
  });

  afterEach(() => {
    db.close();
  });

  describe('getActiveQuestDefinitions', () => {
    it('returns hardcoded quest definitions', () => {
      const definitions = getActiveQuestDefinitions();
      
      expect(definitions.length).toBeGreaterThan(0);
      expect(definitions.some(d => d.id === 'cleanup_sonstiges')).toBe(true);
      expect(definitions.some(d => d.id === 'import_more_data')).toBe(true);
    });

    it('includes cleanup_sonstiges quest with correct properties', () => {
      const definitions = getActiveQuestDefinitions();
      const cleanup = definitions.find(d => d.id === 'cleanup_sonstiges');
      
      expect(cleanup).toBeDefined();
      expect(cleanup?.kind).toBe('CLEANUP');
      expect(cleanup?.targetValue).toBe(0);
      expect(cleanup?.unit).toBe('transactions');
    });
  });

  describe('ensureQuestDefinitions', () => {
    it('syncs quest definitions to database', () => {
      ensureQuestDefinitions(db);
      
      const rows = db.prepare(`SELECT * FROM quest_definitions WHERE isActive = 1`).all();
      expect(rows.length).toBeGreaterThan(0);
      
      const cleanup = rows.find((r: any) => r.id === 'cleanup_sonstiges');
      expect(cleanup).toBeDefined();
      expect(cleanup?.title).toBe('Räume Sonstiges auf');
    });

    it('is idempotent (can be called multiple times)', () => {
      ensureQuestDefinitions(db);
      const firstCount = db.prepare(`SELECT COUNT(*) as count FROM quest_definitions`).get() as { count: number };
      
      ensureQuestDefinitions(db);
      const secondCount = db.prepare(`SELECT COUNT(*) as count FROM quest_definitions`).get() as { count: number };
      
      expect(firstCount.count).toBe(secondCount.count);
    });
  });

  describe('getUserQuestStates', () => {
    it('creates quest states for all active quest definitions', () => {
      ensureQuestDefinitions(db);
      const states = getUserQuestStates(db, userId);
      
      expect(states.length).toBeGreaterThan(0);
      expect(states.every(s => s.userId === userId)).toBe(true);
    });

    it('computes progress for cleanup_sonstiges quest', () => {
      ensureQuestDefinitions(db);
      
      // Insert 5 uncategorized transactions
      db.exec(`
        INSERT INTO transactions (bookingDate, amountCents, category)
        VALUES 
          ('2025-01-15', -5000, 'other'),
          ('2025-01-16', -3000, 'other'),
          ('2025-01-17', -2000, NULL),
          ('2025-01-18', -4000, 'other_review'),
          ('2025-01-19', -1000, 'other');
      `);
      
      const states = getUserQuestStates(db, userId);
      const cleanupState = states.find(s => s.questId === 'cleanup_sonstiges');
      
      expect(cleanupState).toBeDefined();
      expect(cleanupState?.currentValue).toBe(5);
      expect(cleanupState?.targetValue).toBe(0);
      expect(cleanupState?.status).toBe('ACTIVE');
    });

    it('excludes internal transfers from Sonstiges count', () => {
      ensureQuestDefinitions(db);
      
      // Insert internal transfer with category 'other'
      db.exec(`
        INSERT INTO transactions (bookingDate, amountCents, category, isInternalTransfer)
        VALUES ('2025-01-15', -5000, 'other', 1);
      `);
      
      const states = getUserQuestStates(db, userId);
      const cleanupState = states.find(s => s.questId === 'cleanup_sonstiges');
      
      expect(cleanupState?.currentValue).toBe(0); // Internal transfer excluded
    });

    it('computes progress for import_more_data quest', () => {
      ensureQuestDefinitions(db);
      
      // Insert transactions from different months
      db.exec(`
        INSERT INTO transactions (bookingDate, amountCents, category)
        VALUES 
          ('2025-01-15', -5000, 'groceries'),
          ('2025-02-15', -3000, 'dining'),
          ('2025-03-15', -2000, 'shopping');
      `);
      
      const states = getUserQuestStates(db, userId);
      const importState = states.find(s => s.questId === 'import_more_data');
      
      expect(importState).toBeDefined();
      expect(importState?.currentValue).toBe(3); // 3 distinct months
      expect(importState?.targetValue).toBe(3);
      expect(importState?.progressPercent).toBe(100);
    });

    it('transitions status from LOCKED to ACTIVE when progress > 0', () => {
      ensureQuestDefinitions(db);
      
      // Initially no Sonstiges
      let states = getUserQuestStates(db, userId);
      let cleanupState = states.find(s => s.questId === 'cleanup_sonstiges');
      expect(cleanupState?.status).toBe('LOCKED');
      
      // Add Sonstiges transaction
      db.exec(`
        INSERT INTO transactions (bookingDate, amountCents, category)
        VALUES ('2025-01-15', -5000, 'other');
      `);
      
      states = getUserQuestStates(db, userId);
      cleanupState = states.find(s => s.questId === 'cleanup_sonstiges');
      expect(cleanupState?.status).toBe('ACTIVE');
      expect(cleanupState?.startedAt).toBeTruthy();
    });

    it('transitions status from ACTIVE to COMPLETED when progress >= 100%', () => {
      ensureQuestDefinitions(db);
      
      // Add Sonstiges transaction
      db.exec(`
        INSERT INTO transactions (bookingDate, amountCents, category)
        VALUES ('2025-01-15', -5000, 'other');
      `);
      
      let states = getUserQuestStates(db, userId);
      let cleanupState = states.find(s => s.questId === 'cleanup_sonstiges');
      expect(cleanupState?.status).toBe('ACTIVE');
      
      // Remove Sonstiges (categorize it)
      db.exec(`UPDATE transactions SET category = 'groceries' WHERE category = 'other'`);
      
      states = getUserQuestStates(db, userId);
      cleanupState = states.find(s => s.questId === 'cleanup_sonstiges');
      expect(cleanupState?.status).toBe('COMPLETED');
      expect(cleanupState?.completedAt).toBeTruthy();
      expect(cleanupState?.currentValue).toBe(0);
      expect(cleanupState?.progressPercent).toBe(100);
    });

    it('stores initial baseline for cleanup quest in metadata', () => {
      ensureQuestDefinitions(db);
      
      // Add 10 Sonstiges transactions
      db.exec(`
        INSERT INTO transactions (bookingDate, amountCents, category)
        VALUES 
          ('2025-01-15', -5000, 'other'),
          ('2025-01-16', -3000, 'other'),
          ('2025-01-17', -2000, 'other'),
          ('2025-01-18', -4000, 'other'),
          ('2025-01-19', -1000, 'other'),
          ('2025-01-20', -5000, 'other'),
          ('2025-01-21', -3000, 'other'),
          ('2025-01-22', -2000, 'other'),
          ('2025-01-23', -4000, 'other'),
          ('2025-01-24', -1000, 'other');
      `);
      
      const states = getUserQuestStates(db, userId);
      const cleanupState = states.find(s => s.questId === 'cleanup_sonstiges');
      
      expect(cleanupState?.metadataJson).toBeTruthy();
      const metadata = JSON.parse(cleanupState!.metadataJson!);
      expect(metadata.initialBaseline).toBe(10);
    });

    it('calculates progress based on baseline for cleanup quest', () => {
      ensureQuestDefinitions(db);
      
      // Add 10 Sonstiges initially
      db.exec(`
        INSERT INTO transactions (bookingDate, amountCents, category)
        VALUES 
          ('2025-01-15', -5000, 'other'),
          ('2025-01-16', -3000, 'other'),
          ('2025-01-17', -2000, 'other'),
          ('2025-01-18', -4000, 'other'),
          ('2025-01-19', -1000, 'other'),
          ('2025-01-20', -5000, 'other'),
          ('2025-01-21', -3000, 'other'),
          ('2025-01-22', -2000, 'other'),
          ('2025-01-23', -4000, 'other'),
          ('2025-01-24', -1000, 'other');
      `);
      
      // First call sets baseline
      getUserQuestStates(db, userId);
      
      // Categorize 5 transactions (50% progress)
      db.exec(`UPDATE transactions SET category = 'groceries' WHERE id IN (1, 2, 3, 4, 5)`);
      
      const states = getUserQuestStates(db, userId);
      const cleanupState = states.find(s => s.questId === 'cleanup_sonstiges');
      
      expect(cleanupState?.currentValue).toBe(5); // 5 remaining
      expect(cleanupState?.progressPercent).toBe(50); // 50% done (5/10 cleaned)
    });
  });

  describe('getQuestsForUser', () => {
    it('returns only ACTIVE quests (hides COMPLETED)', () => {
      ensureQuestDefinitions(db);
      
      // No Sonstiges - cleanup quest should be LOCKED (not returned)
      // Import quest should be ACTIVE if < 3 months
      db.exec(`
        INSERT INTO transactions (bookingDate, amountCents, category)
        VALUES ('2025-01-15', -5000, 'groceries');
      `);
      
      const quests = getQuestsForUser(db, userId);
      
      // Should only return ACTIVE quests
      expect(quests.every(q => q.status === 'ACTIVE')).toBe(true);
      expect(quests.length).toBeGreaterThan(0);
    });

    it('returns quests with correct DTO format', () => {
      ensureQuestDefinitions(db);
      
      // Add Sonstiges to make cleanup quest active
      db.exec(`
        INSERT INTO transactions (bookingDate, amountCents, category)
        VALUES ('2025-01-15', -5000, 'other');
      `);
      
      const quests = getQuestsForUser(db, userId);
      const cleanupQuest = quests.find(q => q.id === 'cleanup_sonstiges');
      
      expect(cleanupQuest).toBeDefined();
      expect(cleanupQuest?.title).toBe('Räume Sonstiges auf');
      expect(cleanupQuest?.description).toBeTruthy();
      expect(cleanupQuest?.kind).toBe('CLEANUP');
      expect(cleanupQuest?.status).toBe('ACTIVE');
      expect(cleanupQuest?.cta.label).toBe('Los geht\'s');
      expect(cleanupQuest?.cta.href).toBe('/review');
      expect(cleanupQuest?.progressPercent).toBeGreaterThanOrEqual(0);
      expect(cleanupQuest?.progressPercent).toBeLessThanOrEqual(100);
    });

    it('sorts quests by status (ACTIVE first) and progress (descending)', () => {
      ensureQuestDefinitions(db);
      
      // Add conditions for multiple quests
      db.exec(`
        INSERT INTO transactions (bookingDate, amountCents, category)
        VALUES ('2025-01-15', -5000, 'other');
      `);
      
      const quests = getQuestsForUser(db, userId);
      
      // All should be ACTIVE (COMPLETED are hidden)
      expect(quests.every(q => q.status === 'ACTIVE')).toBe(true);
      
      // Should be sorted by progress (descending)
      for (let i = 0; i < quests.length - 1; i++) {
        expect(quests[i].progressPercent).toBeGreaterThanOrEqual(quests[i + 1].progressPercent);
      }
    });
  });
});

