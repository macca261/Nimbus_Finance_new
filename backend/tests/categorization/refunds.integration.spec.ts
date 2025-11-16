import { describe, expect, it, beforeEach } from 'vitest';
import { replaceDb, insertTransactions, clearAll, prepareDb, openDb } from '../../src/db';
import type { Database } from '../../src/db';
import type { CanonicalRow } from '../../src/db';

describe('refund pairing integration', () => {
  let db: Database;

  beforeEach(() => {
    db = openDb();
    prepareDb(db);
    clearAll(db);
  });

  it('pairs insurance charge and refund, excludes from summary', async () => {
    // Use dates in the past to ensure they're within the query window
    const today = new Date();
    const chargeDate = new Date(today);
    chargeDate.setDate(chargeDate.getDate() - 10); // 10 days ago
    const refundDate = new Date(today);
    refundDate.setDate(refundDate.getDate() - 5); // 5 days ago
    
    // Insert charge first
    const charge: CanonicalRow = {
      bookingDate: chargeDate.toISOString().split('T')[0],
      valueDate: chargeDate.toISOString().split('T')[0],
      amountCents: -2900, // -29.00 €
      currency: 'EUR',
      purpose: 'EUROP ASSISTANCE, PARIS FR',
      counterpartName: 'EUROP ASSISTANCE, PARIS FR',
      accountId: 'test:account',
      source: 'csv_bank',
    };

    const result1 = insertTransactions([charge], db);
    expect(result1.inserted).toBe(1);

    // Insert refund later
    const refund: CanonicalRow = {
      bookingDate: refundDate.toISOString().split('T')[0],
      valueDate: refundDate.toISOString().split('T')[0],
      amountCents: 2900, // +29.00 €
      currency: 'EUR',
      purpose: 'EUROP ASSISTANCE, PARIS FR',
      counterpartName: 'EUROP ASSISTANCE, PARIS FR',
      accountId: 'test:account',
      source: 'csv_bank',
    };

    const result2 = insertTransactions([refund], db);
    expect(result2.inserted).toBe(1);

    // Verify both rows have refund flags set
    const chargeRow = db
      .prepare(`SELECT publicId, isRefund, isRefunded, refundGroupId, amountCents FROM transactions WHERE amountCents < 0`)
      .get() as any;
    const refundRow = db
      .prepare(`SELECT publicId, isRefund, isRefunded, refundGroupId, amountCents FROM transactions WHERE amountCents > 0`)
      .get() as any;

    expect(chargeRow).toBeDefined();
    expect(refundRow).toBeDefined();
    expect(chargeRow.isRefunded).toBe(1);
    expect(chargeRow.isRefund).toBe(0);
    expect(refundRow.isRefund).toBe(1);
    expect(refundRow.isRefunded).toBe(0);
    expect(chargeRow.refundGroupId).toBe(refundRow.refundGroupId);
    expect(chargeRow.refundGroupId).not.toBeNull();

    // Verify summary excludes refund pairs (should be 0 for insurance category)
    const monthStart = new Date(today);
    monthStart.setDate(1);
    const monthEnd = new Date(today);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0);
    
    const summary = db
      .prepare(`
        SELECT
          COALESCE(NULLIF(TRIM(category), ''), 'other_review') AS category,
          SUM(CASE WHEN amountCents < 0 THEN amountCents ELSE 0 END) AS spendCents
        FROM transactions
        WHERE bookingDate BETWEEN ? AND ?
          AND (isRefund = 0 OR isRefund IS NULL)
          AND (isRefunded = 0 OR isRefunded IS NULL)
        GROUP BY category
      `)
      .all(monthStart.toISOString().split('T')[0], monthEnd.toISOString().split('T')[0]) as Array<{ category: string; spendCents: number | null }>;

    // Should not have insurance category with -29.00 (refund pair excluded)
    const insuranceEntry = summary.find(s => s.category === 'insurance' || s.category.includes('insurance'));
    if (insuranceEntry) {
      expect(Math.abs(insuranceEntry.spendCents ?? 0)).toBe(0);
    }

    // Verify transactions API still returns both rows with flags
    const allRows = db
      .prepare(`
        SELECT publicId, amountCents, isRefund, isRefunded, refundGroupId
        FROM transactions
        ORDER BY bookingDate
      `)
      .all() as Array<{ publicId: string; amountCents: number; isRefund: number; isRefunded: number; refundGroupId: string | null }>;

    expect(allRows.length).toBe(2);
    const chargeApi = allRows.find(r => r.amountCents < 0);
    const refundApi = allRows.find(r => r.amountCents > 0);

    expect(chargeApi).toBeDefined();
    expect(refundApi).toBeDefined();
    expect(chargeApi?.isRefunded).toBe(1);
    expect(chargeApi?.isRefund).toBe(0);
    expect(refundApi?.isRefund).toBe(1);
    expect(refundApi?.isRefunded).toBe(0);
    expect(chargeApi?.refundGroupId).toBe(refundApi?.refundGroupId);
  });
});

