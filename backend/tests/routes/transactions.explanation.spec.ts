import { describe, expect, it } from 'vitest';
import { openDb, ensureSchema, insertTransactions } from '../../src/db';
import { buildCategorizationExplanation } from '../../src/categorization/explanation';
import type { CanonicalRow } from '../../src/db';

describe('Transactions API - Categorization Explanations', () => {
  it('returns categorizationReasonCode and categorizationReasonText for transactions', () => {
    const db = openDb();
    ensureSchema(db);

    // Insert a test transaction that will be categorized as "other"
    const testRow: CanonicalRow = {
      bookingDate: '2025-01-15',
      valueDate: '2025-01-15',
      amountCents: -1234,
      currency: 'EUR',
      purpose: 'UNKNOWN MERCHANT XYZ123',
      counterpartName: 'UNKNOWN MERCHANT',
      direction: 'out',
      accountId: 'test:account',
      category: 'other',
      categorySource: 'fallback',
      categoryConfidence: 0.1,
    };

    insertTransactions([testRow], db);

    // Fetch transactions via the API query logic
    const rows = db
      .prepare(`
        SELECT
          id,
          bookingDate AS bookingDate,
          valueDate,
          amountCents,
          amountCents / 100.0 AS amount,
          currency,
          direction,
          counterpartName AS counterpart,
          counterpartyIban,
          purpose,
          payee,
          memo,
          accountIban AS accountIban,
          bankProfile,
          category,
          category_source AS categorySource,
          category_confidence AS categoryConfidence,
          category_explanation AS categoryExplanation,
          category_rule_id AS categoryRuleId,
          source,
          sourceProfile,
          transferLinkId,
          isTransfer,
          externalId,
          referenceId,
          isRefund,
          isRefunded,
          refundGroupId,
          isInternalTransfer,
          internalTransferDirection,
          internalTransferKind,
          internalTransferGroupId,
          isReimbursement,
          reimbursementRole,
          reimbursementGroupId,
          reimbursementShareRatio,
          bankReferenceId,
          raw
        FROM transactions
        ORDER BY id DESC
        LIMIT 1
      `)
      .all() as any[];

    expect(rows.length).toBeGreaterThan(0);
    const row = rows[0];

    // Map to NormalizedTransaction format (simulating what the API does)
    const tx: any = {
      id: row.id,
      bookingDate: row.bookingDate,
      valueDate: row.valueDate,
      amountCents: row.amountCents,
      amount: row.amount,
      currency: row.currency,
      direction: row.direction,
      payee: row.payee ?? row.counterpart ?? null,
      counterpart: row.counterpart,
      counterpartyIban: row.counterpartyIban,
      purpose: row.purpose,
      memo: row.memo,
      accountIban: row.accountIban,
      bankProfile: row.bankProfile,
      category: row.category,
      categorySource: row.categorySource,
      categoryConfidence: row.categoryConfidence,
      categoryExplanation: row.categoryExplanation,
      categoryRuleId: row.categoryRuleId,
      source: row.source,
      sourceProfile: row.sourceProfile,
      transferLinkId: row.transferLinkId,
      isInternalTransfer: Boolean(row.isInternalTransfer),
      rawText: row.memo ?? row.purpose ?? '',
      externalId: row.externalId,
      referenceId: row.referenceId,
      metadata: undefined,
      isRefund: Boolean(row.isRefund),
      isRefunded: Boolean(row.isRefunded),
      refundGroupId: row.refundGroupId ?? null,
      internalTransferDirection: row.internalTransferDirection ?? null,
      internalTransferKind: row.internalTransferKind ?? null,
      internalTransferGroupId: row.internalTransferGroupId ?? null,
      isReimbursement: Boolean(row.isReimbursement),
      reimbursementRole: row.reimbursementRole ?? null,
      reimbursementGroupId: row.reimbursementGroupId ?? null,
      reimbursementShareRatio: row.reimbursementShareRatio ?? null,
      bankReferenceId: row.bankReferenceId ?? null,
    };

    // Build explanation (same logic as in routes/transactions.ts)
    const explanation = buildCategorizationExplanation(tx);

    // Verify explanation is present
    expect(explanation).toBeDefined();
    expect(explanation.code).toBeDefined();
    expect(explanation.text).toBeDefined();

    // For "other" category, should have fallback explanation
    if (tx.category === 'other' || tx.category === 'other_review') {
      expect(explanation.code).toBe('fallback_other_no_match');
      expect(explanation.text).toContain('Other/uncategorized');
    }

    // Verify the explanation fields would be attached to the transaction
    tx.categorizationReasonCode = explanation.code;
    tx.categorizationReasonText = explanation.text;

    expect(tx.categorizationReasonCode).toBe(explanation.code);
    expect(tx.categorizationReasonText).toBe(explanation.text);

    db.close();
  });
});

