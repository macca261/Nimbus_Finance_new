import { describe, expect, it } from 'vitest';
import { findReimbursementMatchForIncome, applyReimbursementFlags } from '../../src/categorization/reimbursementMatcher';
import type { NormalizedCanonicalRow } from '../../src/db';

describe('reimbursementMatcher', () => {
  const createRow = (
    publicId: string,
    amountCents: number,
    counterpartName: string,
    bookingDate: string,
    accountId: string,
    category: string | null = null,
  ): NormalizedCanonicalRow => ({
    publicId,
    bookingDate,
    valueDate: bookingDate,
    amountCents,
    currency: 'EUR',
    purpose: counterpartName,
    counterpartName,
    counterpartyIban: null,
    accountIban: null,
    bankProfile: null,
    rawCode: undefined,
    raw: {},
    importFile: null,
    importBatchId: null,
    category,
    categoryConfidence: null,
    categorySource: null,
    categoryExplanation: null,
    categoryRuleId: null,
    direction: amountCents >= 0 ? 'in' : 'out',
    fingerprint: `fp_${publicId}`,
    source: 'csv_bank',
    sourceProfile: null,
    accountId,
    payee: counterpartName,
    memo: counterpartName,
    externalId: null,
    referenceId: null,
    isTransfer: false,
    transferLinkId: null,
    confidence: null,
    isRefund: false,
    isRefunded: false,
    refundGroupId: null,
    isInternalTransfer: false,
    internalTransferDirection: null,
    internalTransferKind: null,
    internalTransferGroupId: null,
    isReimbursement: false,
    reimbursementRole: null,
    reimbursementGroupId: null,
    reimbursementShareRatio: null,
    createdAt: bookingDate,
    transactionPayload: {} as any,
  });

  describe('findReimbursementMatchForIncome', () => {
    it('matches full reimbursement: expense -10000, income +10000 → ratio 1.0', () => {
      const expense = createRow('exp1', -10000, 'REWE SAGT DANKE', '2025-01-15', 'account:giro', 'groceries');
      const income = createRow('inc1', 10000, 'PAYPAL P2P MAXINE', '2025-01-16', 'account:giro');
      
      const match = findReimbursementMatchForIncome(income, [expense], {
        daysWindow: 30,
        minRatio: 0.25,
        maxRatio: 1.0,
      });
      
      expect(match).not.toBeNull();
      expect(match?.shareRatio).toBeCloseTo(1.0, 2);
      expect(match?.expense.publicId).toBe('exp1');
      expect(match?.income.publicId).toBe('inc1');
      expect(match?.groupId).toMatch(/^rb_/);
    });

    it('matches half reimbursement: expense -10000, income +5000 → ratio 0.5', () => {
      const expense = createRow('exp1', -10000, 'REWE SAGT DANKE', '2025-01-15', 'account:giro', 'groceries');
      const income = createRow('inc1', 5000, 'PAYPAL P2P MAXINE', '2025-01-16', 'account:giro');
      
      const match = findReimbursementMatchForIncome(income, [expense], {
        daysWindow: 30,
        minRatio: 0.25,
        maxRatio: 1.0,
      });
      
      expect(match).not.toBeNull();
      expect(match?.shareRatio).toBeCloseTo(0.5, 2);
    });

    it('does not match out-of-window (>30 days)', () => {
      const expense = createRow('exp1', -10000, 'REWE SAGT DANKE', '2025-01-15', 'account:giro', 'groceries');
      const income = createRow('inc1', 10000, 'PAYPAL P2P MAXINE', '2025-02-20', 'account:giro'); // 36 days later
      
      const match = findReimbursementMatchForIncome(income, [expense], {
        daysWindow: 30,
        minRatio: 0.25,
        maxRatio: 1.0,
      });
      
      expect(match).toBeNull();
    });

    it('does not match ratio too small (10%)', () => {
      const expense = createRow('exp1', -10000, 'REWE SAGT DANKE', '2025-01-15', 'account:giro', 'groceries');
      const income = createRow('inc1', 1000, 'PAYPAL P2P MAXINE', '2025-01-16', 'account:giro'); // 10% only
      
      const match = findReimbursementMatchForIncome(income, [expense], {
        daysWindow: 30,
        minRatio: 0.25,
        maxRatio: 1.0,
      });
      
      expect(match).toBeNull();
    });

    it('does not match if income is from refund', () => {
      const expense = createRow('exp1', -10000, 'REWE SAGT DANKE', '2025-01-15', 'account:giro', 'groceries');
      const income = createRow('inc1', 10000, 'PAYPAL P2P MAXINE', '2025-01-16', 'account:giro');
      income.isRefund = true;
      
      const match = findReimbursementMatchForIncome(income, [expense], {
        daysWindow: 30,
        minRatio: 0.25,
        maxRatio: 1.0,
      });
      
      expect(match).toBeNull();
    });

    it('does not match if income is internal transfer', () => {
      const expense = createRow('exp1', -10000, 'REWE SAGT DANKE', '2025-01-15', 'account:giro', 'groceries');
      const income = createRow('inc1', 10000, 'PAYPAL P2P MAXINE', '2025-01-16', 'account:giro');
      income.isInternalTransfer = true;
      
      const match = findReimbursementMatchForIncome(income, [expense], {
        daysWindow: 30,
        minRatio: 0.25,
        maxRatio: 1.0,
      });
      
      expect(match).toBeNull();
    });

    it('does not match if expense is refund', () => {
      const expense = createRow('exp1', -10000, 'REWE SAGT DANKE', '2025-01-15', 'account:giro', 'groceries');
      expense.isRefunded = true;
      const income = createRow('inc1', 10000, 'PAYPAL P2P MAXINE', '2025-01-16', 'account:giro');
      
      const match = findReimbursementMatchForIncome(income, [expense], {
        daysWindow: 30,
        minRatio: 0.25,
        maxRatio: 1.0,
      });
      
      expect(match).toBeNull();
    });

    it('does not match if expense is internal transfer', () => {
      const expense = createRow('exp1', -10000, 'REWE SAGT DANKE', '2025-01-15', 'account:giro', 'groceries');
      expense.isInternalTransfer = true;
      const income = createRow('inc1', 10000, 'PAYPAL P2P MAXINE', '2025-01-16', 'account:giro');
      
      const match = findReimbursementMatchForIncome(income, [expense], {
        daysWindow: 30,
        minRatio: 0.25,
        maxRatio: 1.0,
      });
      
      expect(match).toBeNull();
    });

    it('prefers same category when multiple matches exist', () => {
      const expense1 = createRow('exp1', -10000, 'REWE SAGT DANKE', '2025-01-15', 'account:giro', 'groceries');
      const expense2 = createRow('exp2', -10000, 'AMAZON', '2025-01-14', 'account:giro', 'shopping');
      const income = createRow('inc1', 10000, 'PAYPAL P2P MAXINE', '2025-01-16', 'account:giro');
      income.category = 'groceries';
      
      const match = findReimbursementMatchForIncome(income, [expense1, expense2], {
        daysWindow: 30,
        minRatio: 0.25,
        maxRatio: 1.0,
      });
      
      expect(match).not.toBeNull();
      expect(match?.expense.publicId).toBe('exp1'); // Should prefer groceries
    });
  });

  describe('applyReimbursementFlags', () => {
    it('applies flags correctly to both rows', () => {
      const expense = createRow('exp1', -10000, 'REWE SAGT DANKE', '2025-01-15', 'account:giro', 'groceries');
      const income = createRow('inc1', 5000, 'PAYPAL P2P MAXINE', '2025-01-16', 'account:giro');
      
      const match = findReimbursementMatchForIncome(income, [expense], {
        daysWindow: 30,
        minRatio: 0.25,
        maxRatio: 1.0,
      });
      expect(match).not.toBeNull();
      
      const flagged = applyReimbursementFlags(match!);
      
      expect(flagged.expense.isReimbursement).toBe(true);
      expect(flagged.expense.reimbursementRole).toBe('payer');
      expect(flagged.expense.reimbursementGroupId).toBe(match!.groupId);
      expect(flagged.expense.reimbursementShareRatio).toBeCloseTo(0.5, 2);
      
      expect(flagged.income.isReimbursement).toBe(true);
      expect(flagged.income.reimbursementRole).toBe('receiver');
      expect(flagged.income.reimbursementGroupId).toBe(match!.groupId);
      expect(flagged.income.reimbursementShareRatio).toBeCloseTo(0.5, 2);
    });
  });
});

