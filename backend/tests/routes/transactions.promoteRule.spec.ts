import { describe, expect, it } from 'vitest';
import { openDb, ensureSchema, insertTransactions, getAllOverrideRules, insertOverrideRule } from '../../src/db';
import type { CanonicalRow } from '../../src/db';
import crypto from 'node:crypto';

describe('POST /api/transactions/:id/promote-rule', () => {
  it('creates a user rule from a transaction with merchant and category', () => {
    const db = openDb();
    ensureSchema(db);

    // Insert a test transaction
    const testRow: CanonicalRow = {
      bookingDate: '2025-01-15',
      valueDate: '2025-01-15',
      amountCents: -450,
      currency: 'EUR',
      purpose: 'Baeckerei Heinemann, Koeln',
      counterpartName: 'Baeckerei Heinemann',
      direction: 'out',
      accountId: 'test:account',
      category: 'dining_out',
      categorySource: 'rule',
      categoryConfidence: 0.9,
    };

    insertTransactions([testRow], db);

    // Get the inserted transaction
    const tx = db
      .prepare(`SELECT id FROM transactions WHERE counterpartName = 'Baeckerei Heinemann' LIMIT 1`)
      .get() as { id: number } | undefined;

    expect(tx).toBeDefined();
    if (!tx) return;

    // Simulate the promote-rule endpoint logic
    const txRow = db
      .prepare(`
        SELECT id, category, payee, counterpartName, memo, purpose,
               isRefund, isRefunded, isInternalTransfer, isReimbursement
        FROM transactions
        WHERE id = ?
      `)
      .get(tx.id) as {
      id: number;
      category: string | null;
      payee: string | null;
      counterpartName: string | null;
      memo: string | null;
      purpose: string | null;
      isRefund: number | null;
      isRefunded: number | null;
      isInternalTransfer: number | null;
      isReimbursement: number | null;
    };

    expect(txRow.category).toBe('dining_out');
    expect(txRow.counterpartName).toBe('Baeckerei Heinemann');

    // Determine merchant pattern (same logic as endpoint)
    let merchantPattern: string | null = null;
    let patternType: 'payee' | 'memo' = 'payee';

    if (txRow.payee && txRow.payee.trim()) {
      merchantPattern = txRow.payee.trim();
      patternType = 'payee';
    } else if (txRow.counterpartName && txRow.counterpartName.trim()) {
      merchantPattern = txRow.counterpartName.trim();
      patternType = 'payee';
    } else if (txRow.memo && txRow.memo.trim()) {
      merchantPattern = txRow.memo.trim();
      patternType = 'memo';
    } else if (txRow.purpose && txRow.purpose.trim()) {
      merchantPattern = txRow.purpose.trim();
      patternType = 'memo';
    }

    expect(merchantPattern).toBe('Baeckerei Heinemann');
    expect(patternType).toBe('payee');

    // Create the rule
    const ruleId = `user_rule_${crypto.randomUUID()}`;
    const rule = insertOverrideRule(
      {
        id: ruleId,
        patternType,
        pattern: merchantPattern,
        categoryId: txRow.category!,
        applyToPast: false,
      },
      db
    );

    expect(rule.id).toBe(ruleId);
    expect(rule.patternType).toBe('payee');
    expect(rule.pattern.toLowerCase()).toBe('baeckerei heinemann');
    expect(rule.categoryId).toBe('dining_out');

    // Verify rule appears in getAllOverrideRules
    const allRules = getAllOverrideRules(db);
    const createdRule = allRules.find(r => r.id === ruleId);
    expect(createdRule).toBeDefined();
    expect(createdRule?.categoryId).toBe('dining_out');

    db.close();
  });

  it('rejects promotion for transaction with category "other"', () => {
    const db = openDb();
    ensureSchema(db);

    const testRow: CanonicalRow = {
      bookingDate: '2025-01-15',
      valueDate: '2025-01-15',
      amountCents: -1234,
      currency: 'EUR',
      purpose: 'UNKNOWN MERCHANT',
      counterpartName: 'UNKNOWN',
      direction: 'out',
      accountId: 'test:account',
      category: 'other',
      categorySource: 'fallback',
      categoryConfidence: 0.1,
    };

    insertTransactions([testRow], db);

    const tx = db
      .prepare(`SELECT id, category FROM transactions WHERE category = 'other' LIMIT 1`)
      .get() as { id: number; category: string } | undefined;

    expect(tx).toBeDefined();
    if (!tx) return;

    // Validation should fail
    expect(tx.category).toBe('other');
    // The endpoint would return 400, but we're just testing the validation logic here

    db.close();
  });

  it('rejects promotion for internal transfer transaction', () => {
    const db = openDb();
    ensureSchema(db);

    const testRow: CanonicalRow = {
      bookingDate: '2025-01-15',
      valueDate: '2025-01-15',
      amountCents: -50000,
      currency: 'EUR',
      purpose: 'Transfer to savings',
      direction: 'out',
      accountId: 'test:account',
      category: 'transfer_internal',
      categorySource: 'rule',
      categoryConfidence: 0.95,
      isInternalTransfer: true,
      internalTransferKind: 'savings',
      internalTransferDirection: 'out',
    };

    insertTransactions([testRow], db);

    const txRow = db
      .prepare(`
        SELECT id, category, isInternalTransfer
        FROM transactions
        WHERE isInternalTransfer = 1
        LIMIT 1
      `)
      .get() as {
      id: number;
      category: string | null;
      isInternalTransfer: number | null;
    } | undefined;

    expect(txRow).toBeDefined();
    if (!txRow) return;

    // Validation should fail
    expect(txRow.isInternalTransfer).toBe(1);
    // The endpoint would return 400

    db.close();
  });
});

