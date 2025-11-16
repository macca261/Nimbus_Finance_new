import { describe, expect, it } from 'vitest';
import { openDb, ensureSchema } from '../../src/db';

describe('Database schema', () => {
  it('transactions table includes all expected columns', () => {
    const db = openDb();
    ensureSchema(db);

    const columns = db.prepare(`PRAGMA table_info('transactions')`).all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>;

    const columnNames = columns.map(c => c.name).sort();

    // Core existing fields
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('bookingDate');
    expect(columnNames).toContain('valueDate');
    expect(columnNames).toContain('amountCents');
    expect(columnNames).toContain('currency');
    expect(columnNames).toContain('purpose');
    expect(columnNames).toContain('counterpartName');
    expect(columnNames).toContain('accountIban');
    expect(columnNames).toContain('rawCode');
    expect(columnNames).toContain('createdAt');
    expect(columnNames).toContain('category');
    expect(columnNames).toContain('categoryConfidence');
    expect(columnNames).toContain('category_source');
    expect(columnNames).toContain('category_explanation');
    expect(columnNames).toContain('category_rule_id');
    expect(columnNames).toContain('raw');
    expect(columnNames).toContain('importFile');
    expect(columnNames).toContain('importBatchId');
    expect(columnNames).toContain('fingerprint');
    expect(columnNames).toContain('direction');
    expect(columnNames).toContain('counterpartyIban');
    expect(columnNames).toContain('bankProfile');
    expect(columnNames).toContain('publicId');
    expect(columnNames).toContain('source');
    expect(columnNames).toContain('sourceProfile');
    expect(columnNames).toContain('accountId');
    expect(columnNames).toContain('payee');
    expect(columnNames).toContain('memo');
    expect(columnNames).toContain('externalId');
    expect(columnNames).toContain('referenceId');
    expect(columnNames).toContain('isTransfer');
    expect(columnNames).toContain('transferLinkId');
    expect(columnNames).toContain('confidence');

    // Refund fields
    expect(columnNames).toContain('isRefund');
    expect(columnNames).toContain('isRefunded');
    expect(columnNames).toContain('refundGroupId');

    // Internal transfer fields
    expect(columnNames).toContain('isInternalTransfer');
    expect(columnNames).toContain('internalTransferDirection');
    expect(columnNames).toContain('internalTransferKind');
    expect(columnNames).toContain('internalTransferGroupId');

    // Reimbursement fields
    expect(columnNames).toContain('isReimbursement');
    expect(columnNames).toContain('reimbursementRole');
    expect(columnNames).toContain('reimbursementGroupId');
    expect(columnNames).toContain('reimbursementShareRatio');

    // Bank reference ID (newly added)
    expect(columnNames).toContain('bankReferenceId');

    // Verify total column count is reasonable (should be at least 44)
    expect(columns.length).toBeGreaterThanOrEqual(44);

    db.close();
  });

  it('bankReferenceId column has correct type', () => {
    const db = openDb();
    ensureSchema(db);

    const columns = db.prepare(`PRAGMA table_info('transactions')`).all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>;

    const bankRefColumn = columns.find(c => c.name === 'bankReferenceId');
    expect(bankRefColumn).toBeDefined();
    expect(bankRefColumn?.type.toUpperCase()).toContain('TEXT');
    expect(bankRefColumn?.notnull).toBe(0); // Should allow NULL

    db.close();
  });
});

