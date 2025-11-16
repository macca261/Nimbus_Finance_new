import { describe, expect, it, beforeEach } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import { ensureSchema, insertOverrideRule, insertTransactions, applyOverrideRuleToExistingTransactions } from '../../src/db';
import type { CanonicalRow } from '../../src/db';
import crypto from 'node:crypto';

describe('POST /api/transactions/user-rules/:id/apply', () => {
  let db: BetterSqlite3.Database;

  beforeEach(() => {
    db = new BetterSqlite3(':memory:');
    ensureSchema(db);
  });

  it('returns 0 updatedCount when rule not found', () => {
    const result = applyOverrideRuleToExistingTransactions('nonexistent-rule-id', db);
    expect(result.updatedCount).toBe(0);
  });

  it('applies rule to matching transactions', () => {
    // Insert test transactions
    const testRows: CanonicalRow[] = [
      {
        bookingDate: '2025-01-15',
        valueDate: '2025-01-15',
        amountCents: -450,
        currency: 'EUR',
        purpose: 'Baeckerei Heinemann, Koeln',
        counterpartName: 'Baeckerei Heinemann',
        direction: 'out',
        accountId: 'test:account',
        category: 'other',
        categorySource: 'fallback',
        categoryConfidence: 0.1,
      },
      {
        bookingDate: '2025-01-16',
        valueDate: '2025-01-16',
        amountCents: -320,
        currency: 'EUR',
        purpose: 'Baeckerei Heinemann, Hamburg',
        counterpartName: 'Baeckerei Heinemann',
        direction: 'out',
        accountId: 'test:account',
        category: 'other',
        categorySource: 'fallback',
        categoryConfidence: 0.1,
      },
      {
        bookingDate: '2025-01-17',
        valueDate: '2025-01-17',
        amountCents: -1200,
        currency: 'EUR',
        purpose: 'LIDL Supermarket',
        counterpartName: 'LIDL',
        direction: 'out',
        accountId: 'test:account',
        category: 'other',
        categorySource: 'fallback',
        categoryConfidence: 0.1,
      },
    ];

    insertTransactions(testRows, db);

    // Create a rule
    const ruleId = `user_rule_${crypto.randomUUID()}`;
    insertOverrideRule(
      {
        id: ruleId,
        patternType: 'payee',
        pattern: 'Baeckerei Heinemann',
        categoryId: 'dining_out',
        applyToPast: false,
      },
      db
    );

    // Apply the rule
    const result = applyOverrideRuleToExistingTransactions(ruleId, db);
    expect(result.updatedCount).toBe(2); // Should match 2 transactions

    // Verify the matching transactions were updated
    const updated = db
      .prepare(`
        SELECT id, category, category_source, category_rule_id
        FROM transactions
        WHERE counterpartName LIKE '%Baeckerei Heinemann%'
        ORDER BY bookingDate
      `)
      .all() as Array<{
      id: number;
      category: string | null;
      category_source: string | null;
      category_rule_id: string | null;
    }>;

    expect(updated.length).toBe(2);
    expect(updated[0].category).toBe('dining_out');
    expect(updated[0].category_source).toBe('user');
    expect(updated[0].category_rule_id).toBe(`user_override:${ruleId}`);
    expect(updated[1].category).toBe('dining_out');
    expect(updated[1].category_source).toBe('user');
    expect(updated[1].category_rule_id).toBe(`user_override:${ruleId}`);

    // Verify the non-matching transaction was not updated
    const notUpdated = db
      .prepare(`
        SELECT id, category, category_source
        FROM transactions
        WHERE counterpartName LIKE '%LIDL%'
      `)
      .get() as {
      id: number;
      category: string | null;
      category_source: string | null;
    };

    expect(notUpdated.category).toBe('other');
    expect(notUpdated.category_source).toBe('fallback');
  });

  it('does not touch refunds, internal transfers, or reimbursements', () => {
    // Insert test transactions with flags
    const testRows: CanonicalRow[] = [
      {
        bookingDate: '2025-01-15',
        valueDate: '2025-01-15',
        amountCents: -450,
        currency: 'EUR',
        purpose: 'Baeckerei Heinemann, Koeln',
        counterpartName: 'Baeckerei Heinemann',
        direction: 'out',
        accountId: 'test:account',
        category: 'other',
        categorySource: 'fallback',
        categoryConfidence: 0.1,
        isRefund: true,
      },
      {
        bookingDate: '2025-01-16',
        valueDate: '2025-01-16',
        amountCents: -320,
        currency: 'EUR',
        purpose: 'Baeckerei Heinemann, Hamburg',
        counterpartName: 'Baeckerei Heinemann',
        direction: 'out',
        accountId: 'test:account',
        category: 'other',
        categorySource: 'fallback',
        categoryConfidence: 0.1,
        isInternalTransfer: true,
        internalTransferKind: 'savings',
        internalTransferDirection: 'out',
      },
      {
        bookingDate: '2025-01-17',
        valueDate: '2025-01-17',
        amountCents: -1200,
        currency: 'EUR',
        purpose: 'Baeckerei Heinemann, Berlin',
        counterpartName: 'Baeckerei Heinemann',
        direction: 'out',
        accountId: 'test:account',
        category: 'other',
        categorySource: 'fallback',
        categoryConfidence: 0.1,
        isReimbursement: true,
        reimbursementRole: 'payer',
        reimbursementGroupId: 'reimb_123',
      },
      {
        bookingDate: '2025-01-18',
        valueDate: '2025-01-18',
        amountCents: -500,
        currency: 'EUR',
        purpose: 'Baeckerei Heinemann, Muenchen',
        counterpartName: 'Baeckerei Heinemann',
        direction: 'out',
        accountId: 'test:account',
        category: 'other',
        categorySource: 'fallback',
        categoryConfidence: 0.1,
      },
    ];

    insertTransactions(testRows, db);

    // Create a rule that would match all of them
    const ruleId = `user_rule_${crypto.randomUUID()}`;
    insertOverrideRule(
      {
        id: ruleId,
        patternType: 'payee',
        pattern: 'Baeckerei Heinemann',
        categoryId: 'dining_out',
        applyToPast: false,
      },
      db
    );

    // Apply the rule
    const result = applyOverrideRuleToExistingTransactions(ruleId, db);
    expect(result.updatedCount).toBe(1); // Only the normal transaction should be updated

    // Verify the flagged transactions were NOT updated
    const refundTx = db
      .prepare(`
        SELECT id, category, category_source, isRefund
        FROM transactions
        WHERE isRefund = 1
      `)
      .get() as {
      id: number;
      category: string | null;
      category_source: string | null;
      isRefund: number | null;
    };

    expect(refundTx.category).toBe('other');
    expect(refundTx.category_source).toBe('fallback');

    const transferTx = db
      .prepare(`
        SELECT id, category, category_source, isInternalTransfer
        FROM transactions
        WHERE isInternalTransfer = 1
      `)
      .get() as {
      id: number;
      category: string | null;
      category_source: string | null;
      isInternalTransfer: number | null;
    };

    expect(transferTx.category).toBe('other');
    expect(transferTx.category_source).toBe('fallback');

    const reimbTx = db
      .prepare(`
        SELECT id, category, category_source, isReimbursement
        FROM transactions
        WHERE isReimbursement = 1
      `)
      .get() as {
      id: number;
      category: string | null;
      category_source: string | null;
      isReimbursement: number | null;
    };

    expect(reimbTx.category).toBe('other');
    expect(reimbTx.category_source).toBe('fallback');

    // Verify the normal transaction WAS updated
    const normalTx = db
      .prepare(`
        SELECT id, category, category_source, category_rule_id
        FROM transactions
        WHERE isRefund IS NULL OR isRefund = 0
        AND (isInternalTransfer IS NULL OR isInternalTransfer = 0)
        AND (isReimbursement IS NULL OR isReimbursement = 0)
        AND counterpartName LIKE '%Baeckerei Heinemann%'
      `)
      .get() as {
      id: number;
      category: string | null;
      category_source: string | null;
      category_rule_id: string | null;
    };

    expect(normalTx.category).toBe('dining_out');
    expect(normalTx.category_source).toBe('user');
    expect(normalTx.category_rule_id).toBe(`user_override:${ruleId}`);
  });

  it('is idempotent - can be called multiple times', () => {
    // Insert test transaction
    const testRow: CanonicalRow = {
      bookingDate: '2025-01-15',
      valueDate: '2025-01-15',
      amountCents: -450,
      currency: 'EUR',
      purpose: 'Baeckerei Heinemann, Koeln',
      counterpartName: 'Baeckerei Heinemann',
      direction: 'out',
      accountId: 'test:account',
      category: 'other',
      categorySource: 'fallback',
      categoryConfidence: 0.1,
    };

    insertTransactions([testRow], db);

    // Create a rule
    const ruleId = `user_rule_${crypto.randomUUID()}`;
    insertOverrideRule(
      {
        id: ruleId,
        patternType: 'payee',
        pattern: 'Baeckerei Heinemann',
        categoryId: 'dining_out',
        applyToPast: false,
      },
      db
    );

    // Apply the rule first time
    const result1 = applyOverrideRuleToExistingTransactions(ruleId, db);
    expect(result1.updatedCount).toBe(1);

    // Apply the rule second time
    const result2 = applyOverrideRuleToExistingTransactions(ruleId, db);
    // Should still succeed, but may update 0 rows (already updated) or same rows again
    expect(result2.updatedCount).toBeGreaterThanOrEqual(0);

    // Verify the transaction is still correctly categorized
    const tx = db
      .prepare(`
        SELECT id, category, category_source, category_rule_id
        FROM transactions
        WHERE counterpartName LIKE '%Baeckerei Heinemann%'
      `)
      .get() as {
      id: number;
      category: string | null;
      category_source: string | null;
      category_rule_id: string | null;
    };

    expect(tx.category).toBe('dining_out');
    expect(tx.category_source).toBe('user');
    expect(tx.category_rule_id).toBe(`user_override:${ruleId}`);
  });

  it('applies memo rules to memo and purpose fields', () => {
    // Insert test transactions
    const testRows: CanonicalRow[] = [
      {
        bookingDate: '2025-01-15',
        valueDate: '2025-01-15',
        amountCents: -450,
        currency: 'EUR',
        purpose: 'Uber ride payment',
        memo: 'Uber ride payment',
        direction: 'out',
        accountId: 'test:account',
        category: 'other',
        categorySource: 'fallback',
        categoryConfidence: 0.1,
      },
      {
        bookingDate: '2025-01-16',
        valueDate: '2025-01-16',
        amountCents: -320,
        currency: 'EUR',
        purpose: 'Uber ride payment',
        direction: 'out',
        accountId: 'test:account',
        category: 'other',
        categorySource: 'fallback',
        categoryConfidence: 0.1,
      },
    ];

    insertTransactions(testRows, db);

    // Create a memo rule
    const ruleId = `user_rule_${crypto.randomUUID()}`;
    insertOverrideRule(
      {
        id: ruleId,
        patternType: 'memo',
        pattern: 'Uber ride',
        categoryId: 'transport',
        applyToPast: false,
      },
      db
    );

    // Apply the rule
    const result = applyOverrideRuleToExistingTransactions(ruleId, db);
    expect(result.updatedCount).toBe(2); // Should match both transactions

    // Verify both transactions were updated
    const updated = db
      .prepare(`
        SELECT id, category, category_source
        FROM transactions
        WHERE purpose LIKE '%Uber%' OR memo LIKE '%Uber%'
        ORDER BY bookingDate
      `)
      .all() as Array<{
      id: number;
      category: string | null;
      category_source: string | null;
    }>;

    expect(updated.length).toBe(2);
    expect(updated[0].category).toBe('transport');
    expect(updated[0].category_source).toBe('user');
    expect(updated[1].category).toBe('transport');
    expect(updated[1].category_source).toBe('user');
  });
});

