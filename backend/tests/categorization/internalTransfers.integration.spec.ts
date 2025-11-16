import { describe, expect, it, beforeEach } from 'vitest';
import { replaceDb, insertTransactions, clearAll, prepareDb, openDb } from '../../src/db';
import type { Database } from '../../src/db';
import type { CanonicalRow } from '../../src/db';

describe('internal transfer pairing integration', () => {
  let db: Database;

  beforeEach(() => {
    db = openDb();
    prepareDb(db);
    clearAll(db);
  });

  it('pairs savings transfer, excludes from summary, reports in internal-transfers', async () => {
    // Use dates in the past to ensure they're within the query window
    const today = new Date();
    const outDate = new Date(today);
    outDate.setDate(outDate.getDate() - 2); // 2 days ago
    const inDate = new Date(today);
    inDate.setDate(inDate.getDate() - 1); // 1 day ago
    
    // Insert outgoing transfer first
    const out: CanonicalRow = {
      bookingDate: outDate.toISOString().split('T')[0],
      valueDate: outDate.toISOString().split('T')[0],
      amountCents: -50000, // -500.00 €
      currency: 'EUR',
      purpose: 'Übertrag auf Tagesgeldkonto',
      counterpartName: 'Übertrag auf Tagesgeldkonto',
      accountId: 'account:giro',
      source: 'csv_bank',
    };

    const result1 = insertTransactions([out], db);
    expect(result1.inserted).toBe(1);

    // Insert incoming transfer later
    const in_: CanonicalRow = {
      bookingDate: inDate.toISOString().split('T')[0],
      valueDate: inDate.toISOString().split('T')[0],
      amountCents: 50000, // +500.00 €
      currency: 'EUR',
      purpose: 'Übertrag von Girokonto',
      counterpartName: 'Übertrag von Girokonto',
      accountId: 'account:savings',
      source: 'csv_bank',
    };

    const result2 = insertTransactions([in_], db);
    expect(result2.inserted).toBe(1);

    // Verify both rows have internal transfer flags set
    const outRow = db
      .prepare(`SELECT publicId, isInternalTransfer, internalTransferDirection, internalTransferKind, internalTransferGroupId, amountCents FROM transactions WHERE amountCents < 0`)
      .get() as any;
    const inRow = db
      .prepare(`SELECT publicId, isInternalTransfer, internalTransferDirection, internalTransferKind, internalTransferGroupId, amountCents FROM transactions WHERE amountCents > 0`)
      .get() as any;

    expect(outRow).toBeDefined();
    expect(inRow).toBeDefined();
    expect(outRow.isInternalTransfer).toBe(1);
    expect(inRow.isInternalTransfer).toBe(1);
    expect(outRow.internalTransferDirection).toBe('out');
    expect(inRow.internalTransferDirection).toBe('in');
    expect(outRow.internalTransferKind).toBe('savings');
    expect(inRow.internalTransferKind).toBe('savings');
    expect(outRow.internalTransferGroupId).toBe(inRow.internalTransferGroupId);
    expect(outRow.internalTransferGroupId).not.toBeNull();

    // Verify /api/summary/month does not count 500 € as spending or income
    const monthStart = new Date(today);
    monthStart.setDate(1);
    const monthEnd = new Date(today);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0);
    
    const summary = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN amountCents > 0 THEN amountCents ELSE 0 END), 0) AS incomeCents,
        ABS(COALESCE(SUM(CASE WHEN amountCents < 0 THEN amountCents ELSE 0 END), 0)) AS expenseCents
      FROM transactions
      WHERE bookingDate BETWEEN ? AND ?
        AND (isRefund = 0 OR isRefund IS NULL)
        AND (isRefunded = 0 OR isRefunded IS NULL)
        AND (isInternalTransfer = 0 OR isInternalTransfer IS NULL)
    `).get(monthStart.toISOString().split('T')[0], monthEnd.toISOString().split('T')[0]) as { incomeCents: number; expenseCents: number };

    expect(summary.incomeCents).toBe(0);
    expect(summary.expenseCents).toBe(0);

    // Verify /api/summary/internal-transfers reports savingsOutCents = 50000
    const internalTransfers = db.prepare(`
      SELECT
        internalTransferKind AS kind,
        internalTransferDirection AS direction,
        SUM(ABS(amountCents)) AS totalCents
      FROM transactions
      WHERE isInternalTransfer = 1
        AND bookingDate BETWEEN ? AND ?
      GROUP BY internalTransferKind, internalTransferDirection
    `).all(monthStart.toISOString().split('T')[0], monthEnd.toISOString().split('T')[0]) as Array<{ kind: string | null; direction: string | null; totalCents: number | null }>;

    const savingsOut = internalTransfers.find(r => r.kind === 'savings' && r.direction === 'out');
    expect(savingsOut).toBeDefined();
    expect(savingsOut?.totalCents).toBe(50000);
  });

  it('pairs PayPal top-up / withdrawal with kind wallet', async () => {
    const today = new Date();
    const outDate = new Date(today);
    outDate.setDate(outDate.getDate() - 2);
    const inDate = new Date(today);
    inDate.setDate(inDate.getDate() - 1);
    
    // Insert PayPal top-up (outgoing from bank)
    const out: CanonicalRow = {
      bookingDate: outDate.toISOString().split('T')[0],
      valueDate: outDate.toISOString().split('T')[0],
      amountCents: -4000, // -40.00 €
      currency: 'EUR',
      purpose: 'PayPal Aufladung',
      counterpartName: 'PayPal Aufladung',
      accountId: 'account:giro',
      source: 'csv_bank',
    };

    insertTransactions([out], db);

    // Insert PayPal withdrawal (incoming to bank)
    const in_: CanonicalRow = {
      bookingDate: inDate.toISOString().split('T')[0],
      valueDate: inDate.toISOString().split('T')[0],
      amountCents: 4000, // +40.00 €
      currency: 'EUR',
      purpose: 'PayPal Auszahlung',
      counterpartName: 'PayPal Auszahlung',
      accountId: 'account:paypal',
      source: 'csv_bank',
    };

    insertTransactions([in_], db);

    // Verify both rows have internal transfer flags with kind = 'wallet'
    const outRow = db
      .prepare(`SELECT isInternalTransfer, internalTransferKind, internalTransferDirection FROM transactions WHERE amountCents < 0`)
      .get() as any;
    const inRow = db
      .prepare(`SELECT isInternalTransfer, internalTransferKind, internalTransferDirection FROM transactions WHERE amountCents > 0`)
      .get() as any;

    expect(outRow.isInternalTransfer).toBe(1);
    expect(inRow.isInternalTransfer).toBe(1);
    expect(outRow.internalTransferKind).toBe('wallet');
    expect(inRow.internalTransferKind).toBe('wallet');
    expect(outRow.internalTransferDirection).toBe('out');
    expect(inRow.internalTransferDirection).toBe('in');
  });
});

