import { describe, expect, it, beforeEach } from 'vitest';
import { replaceDb, insertTransactions, clearAll, prepareDb, openDb } from '../../src/db';
import type { Database } from '../../src/db';
import type { CanonicalRow } from '../../src/db';

describe('reimbursement pairing integration', () => {
  let db: Database;

  beforeEach(() => {
    db = openDb();
    prepareDb(db);
    clearAll(db);
  });

  it('pairs groceries expense with reimbursement, computes net spending', async () => {
    // Use dates in the past to ensure they're within the query window
    const today = new Date();
    const expenseDate = new Date(today);
    expenseDate.setDate(expenseDate.getDate() - 2); // 2 days ago
    const incomeDate = new Date(today);
    incomeDate.setDate(incomeDate.getDate() - 1); // 1 day ago
    
    // Insert expense first
    const expense: CanonicalRow = {
      bookingDate: expenseDate.toISOString().split('T')[0],
      valueDate: expenseDate.toISOString().split('T')[0],
      amountCents: -10000, // -100.00 €
      currency: 'EUR',
      purpose: 'REWE SAGT DANKE',
      counterpartName: 'REWE SAGT DANKE',
      accountId: 'account:giro',
      source: 'csv_bank',
      category: 'groceries',
    };

    const result1 = insertTransactions([expense], db);
    expect(result1.inserted).toBe(1);

    // Insert reimbursement income later
    const income: CanonicalRow = {
      bookingDate: incomeDate.toISOString().split('T')[0],
      valueDate: incomeDate.toISOString().split('T')[0],
      amountCents: 5000, // +50.00 €
      currency: 'EUR',
      purpose: 'PAYPAL P2P MAXINE',
      counterpartName: 'PAYPAL P2P MAXINE',
      accountId: 'account:giro',
      source: 'csv_bank',
    };

    const result2 = insertTransactions([income], db);
    expect(result2.inserted).toBe(1);

    // Verify both rows have reimbursement flags set
    const expenseRow = db
      .prepare(`SELECT publicId, isReimbursement, reimbursementRole, reimbursementShareRatio, reimbursementGroupId, amountCents FROM transactions WHERE amountCents < 0`)
      .get() as any;
    const incomeRow = db
      .prepare(`SELECT publicId, isReimbursement, reimbursementRole, reimbursementShareRatio, reimbursementGroupId, amountCents FROM transactions WHERE amountCents > 0`)
      .get() as any;

    expect(expenseRow).toBeDefined();
    expect(incomeRow).toBeDefined();
    expect(expenseRow.isReimbursement).toBe(1);
    expect(incomeRow.isReimbursement).toBe(1);
    expect(expenseRow.reimbursementRole).toBe('payer');
    expect(incomeRow.reimbursementRole).toBe('receiver');
    expect(expenseRow.reimbursementShareRatio).toBeCloseTo(0.5, 2);
    expect(incomeRow.reimbursementShareRatio).toBeCloseTo(0.5, 2);
    expect(expenseRow.reimbursementGroupId).toBe(incomeRow.reimbursementGroupId);
    expect(expenseRow.reimbursementGroupId).not.toBeNull();

    // Verify /api/summary/categories shows net spending
    const monthStart = new Date(today);
    monthStart.setDate(1);
    const monthEnd = new Date(today);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0);
    
    // Get raw spending
    const rawSpending = db.prepare(`
      SELECT
        COALESCE(NULLIF(TRIM(category), ''), 'other_review') AS category,
        SUM(CASE WHEN amountCents < 0 THEN amountCents ELSE 0 END) AS spendCents
      FROM transactions
      WHERE bookingDate BETWEEN ? AND ?
        AND (isRefund = 0 OR isRefund IS NULL)
        AND (isRefunded = 0 OR isRefunded IS NULL)
        AND (isInternalTransfer = 0 OR isInternalTransfer IS NULL)
      GROUP BY category
    `).get(monthStart.toISOString().split('T')[0], monthEnd.toISOString().split('T')[0]) as { category: string; spendCents: number | null } | undefined;

    // Get reimbursements
    const reimbursements = db.prepare(`
      SELECT
        e.category AS category,
        SUM(i.amountCents) AS reimbursementCents
      FROM transactions e
      INNER JOIN transactions i ON e.reimbursementGroupId = i.reimbursementGroupId
        AND e.reimbursementRole = 'payer'
        AND i.reimbursementRole = 'receiver'
      WHERE e.bookingDate BETWEEN ? AND ?
        AND e.isReimbursement = 1
        AND i.isReimbursement = 1
      GROUP BY e.category
    `).get(monthStart.toISOString().split('T')[0], monthEnd.toISOString().split('T')[0]) as { category: string; reimbursementCents: number | null } | undefined;

    if (rawSpending) {
      const rawExpenseCents = Math.abs(rawSpending.spendCents ?? 0);
      const reimbursementsInCents = Math.trunc(reimbursements?.reimbursementCents ?? 0);
      const netExpenseCents = Math.max(0, rawExpenseCents - reimbursementsInCents);
      
      expect(rawExpenseCents).toBe(10000);
      expect(reimbursementsInCents).toBe(5000);
      expect(netExpenseCents).toBe(5000);
    }
  });

  it('does not match random gift payment: income +20 €, no nearby expense', async () => {
    const today = new Date();
    const incomeDate = new Date(today);
    incomeDate.setDate(incomeDate.getDate() - 1);
    
    // Insert income with no matching expense
    const income: CanonicalRow = {
      bookingDate: incomeDate.toISOString().split('T')[0],
      valueDate: incomeDate.toISOString().split('T')[0],
      amountCents: 2000, // +20.00 €
      currency: 'EUR',
      purpose: 'Gift from friend',
      counterpartName: 'Gift from friend',
      accountId: 'account:giro',
      source: 'csv_bank',
    };

    insertTransactions([income], db);

    // Verify income is NOT marked as reimbursement
    const incomeRow = db
      .prepare(`SELECT isReimbursement, reimbursementGroupId FROM transactions WHERE amountCents > 0`)
      .get() as any;

    expect(incomeRow.isReimbursement).toBe(0);
    expect(incomeRow.reimbursementGroupId).toBeNull();
  });
});

