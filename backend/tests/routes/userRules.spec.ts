import { describe, expect, it, beforeEach } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import { ensureSchema, insertOverrideRule, getAllOverrideRules, deleteOverrideRule } from '../../src/db';
import crypto from 'node:crypto';

describe('User Rules API', () => {
  let db: BetterSqlite3.Database;

  beforeEach(() => {
    // Use in-memory database for test isolation
    db = new BetterSqlite3(':memory:');
    ensureSchema(db);
  });

  it('GET /api/transactions/user-rules returns empty list when there are no rules', () => {
    const rules = getAllOverrideRules(db);
    expect(rules).toEqual([]);
  });

  it('GET /api/transactions/user-rules returns created rule', () => {
    const ruleId = `user_rule_${crypto.randomUUID()}`;
    const rule = insertOverrideRule(
      {
        id: ruleId,
        patternType: 'payee',
        pattern: 'Baeckerei Heinemann',
        categoryId: 'dining_out',
        applyToPast: false,
      },
      db
    );

    const allRules = getAllOverrideRules(db);
    expect(allRules.length).toBe(1);
    expect(allRules[0].id).toBe(ruleId);
    expect(allRules[0].pattern).toBe('baeckerei heinemann'); // lowercase
    expect(allRules[0].patternType).toBe('payee');
    expect(allRules[0].categoryId).toBe('dining_out');
    expect(allRules[0].createdAt).toBeDefined();
  });

  it('DELETE /api/transactions/user-rules/:id removes the rule', () => {
    // Create a rule
    const ruleId = `user_rule_${crypto.randomUUID()}`;
    insertOverrideRule(
      {
        id: ruleId,
        patternType: 'memo',
        pattern: 'Test Pattern',
        categoryId: 'groceries',
        applyToPast: false,
      },
      db
    );

    // Verify it exists
    let allRules = getAllOverrideRules(db);
    expect(allRules.length).toBe(1);
    expect(allRules[0].id).toBe(ruleId);

    // Delete it
    const deleted = deleteOverrideRule(ruleId, db);
    expect(deleted).toBe(true);

    // Verify it's gone
    allRules = getAllOverrideRules(db);
    expect(allRules.length).toBe(0);
  });

  it('DELETE /api/transactions/user-rules/:id returns false for non-existent id', () => {
    const deleted = deleteOverrideRule('non-existent-id', db);
    expect(deleted).toBe(false);
  });

  it('can create and delete multiple rules', () => {

    // Create two rules
    const rule1Id = `user_rule_${crypto.randomUUID()}`;
    const rule2Id = `user_rule_${crypto.randomUUID()}`;

    insertOverrideRule(
      {
        id: rule1Id,
        patternType: 'payee',
        pattern: 'LIDL',
        categoryId: 'groceries',
        applyToPast: false,
      },
      db
    );

    insertOverrideRule(
      {
        id: rule2Id,
        patternType: 'memo',
        pattern: 'Uber',
        categoryId: 'transport',
        applyToPast: false,
      },
      db
    );

    let allRules = getAllOverrideRules(db);
    expect(allRules.length).toBe(2);

    // Delete one
    deleteOverrideRule(rule1Id, db);

    allRules = getAllOverrideRules(db);
    expect(allRules.length).toBe(1);
    expect(allRules[0].id).toBe(rule2Id);

    // Delete the other
    deleteOverrideRule(rule2Id, db);

    allRules = getAllOverrideRules(db);
    expect(allRules.length).toBe(0);
  });
});

