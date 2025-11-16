import { describe, expect, it } from 'vitest';
import { buildCategorizationExplanation } from '../../src/categorization/explanation';
import type { NormalizedTransaction } from '../../src/types/transactions';

describe('buildCategorizationExplanation', () => {
  describe('refunds', () => {
    it('returns refund_pair for isRefund transaction', () => {
      const tx: NormalizedTransaction = {
        id: '1',
        bookingDate: '2025-01-15',
        amountCents: 2900,
        currency: 'EUR',
        direction: 'in',
        rawText: 'Refund',
        bankProfile: 'comdirect',
        category: 'other',
        categoryConfidence: 0,
        categorySource: 'fallback',
        isRefund: true,
      };

      const explanation = buildCategorizationExplanation(tx);
      expect(explanation.code).toBe('refund_pair');
      expect(explanation.text).toContain('Refund');
    });

    it('returns refund_pair for isRefunded transaction', () => {
      const tx: NormalizedTransaction = {
        id: '1',
        bookingDate: '2025-01-15',
        amountCents: -2900,
        currency: 'EUR',
        direction: 'out',
        rawText: 'Insurance charge',
        bankProfile: 'comdirect',
        category: 'insurance',
        categoryConfidence: 0.9,
        categorySource: 'rule',
        isRefunded: true,
        refundGroupId: 'refund_123',
      };

      const explanation = buildCategorizationExplanation(tx);
      expect(explanation.code).toBe('refund_pair');
      expect(explanation.text).toContain('Refund');
    });
  });

  describe('internal transfers', () => {
    it('returns internal_transfer_savings_out for savings transfer out', () => {
      const tx: NormalizedTransaction = {
        id: '1',
        bookingDate: '2025-01-15',
        amountCents: -50000,
        currency: 'EUR',
        direction: 'out',
        rawText: 'Transfer to savings',
        bankProfile: 'comdirect',
        category: 'transfer_internal',
        categoryConfidence: 0.95,
        categorySource: 'rule',
        isInternalTransfer: true,
        internalTransferKind: 'savings',
        internalTransferDirection: 'out',
        internalTransferGroupId: 'int_123',
      };

      const explanation = buildCategorizationExplanation(tx);
      expect(explanation.code).toBe('internal_transfer_savings_out');
      expect(explanation.text).toBe('Transfer to savings account');
    });

    it('returns internal_transfer_savings_in for savings transfer in', () => {
      const tx: NormalizedTransaction = {
        id: '1',
        bookingDate: '2025-01-15',
        amountCents: 50000,
        currency: 'EUR',
        direction: 'in',
        rawText: 'Transfer from savings',
        bankProfile: 'comdirect',
        category: 'transfer_internal',
        categoryConfidence: 0.95,
        categorySource: 'rule',
        isInternalTransfer: true,
        internalTransferKind: 'savings',
        internalTransferDirection: 'in',
        internalTransferGroupId: 'int_123',
      };

      const explanation = buildCategorizationExplanation(tx);
      expect(explanation.code).toBe('internal_transfer_savings_in');
      expect(explanation.text).toBe('Transfer from savings account');
    });

    it('returns internal_transfer_wallet_out for wallet top-up', () => {
      const tx: NormalizedTransaction = {
        id: '1',
        bookingDate: '2025-01-15',
        amountCents: -4000,
        currency: 'EUR',
        direction: 'out',
        rawText: 'PayPal top-up',
        bankProfile: 'comdirect',
        category: 'transfer_internal',
        categoryConfidence: 0.95,
        categorySource: 'rule',
        isInternalTransfer: true,
        internalTransferKind: 'wallet',
        internalTransferDirection: 'out',
        internalTransferGroupId: 'int_456',
      };

      const explanation = buildCategorizationExplanation(tx);
      expect(explanation.code).toBe('internal_transfer_wallet_out');
      expect(explanation.text).toContain('Top-up to wallet');
    });

    it('returns internal_transfer_wallet_in for wallet withdrawal', () => {
      const tx: NormalizedTransaction = {
        id: '1',
        bookingDate: '2025-01-15',
        amountCents: 4000,
        currency: 'EUR',
        direction: 'in',
        rawText: 'PayPal withdrawal',
        bankProfile: 'comdirect',
        category: 'transfer_internal',
        categoryConfidence: 0.95,
        categorySource: 'rule',
        isInternalTransfer: true,
        internalTransferKind: 'wallet',
        internalTransferDirection: 'in',
        internalTransferGroupId: 'int_456',
      };

      const explanation = buildCategorizationExplanation(tx);
      expect(explanation.code).toBe('internal_transfer_wallet_in');
      expect(explanation.text).toContain('Withdrawal from wallet');
    });

    it('returns internal_transfer_other for other internal transfers', () => {
      const tx: NormalizedTransaction = {
        id: '1',
        bookingDate: '2025-01-15',
        amountCents: -10000,
        currency: 'EUR',
        direction: 'out',
        rawText: 'Internal transfer',
        bankProfile: 'comdirect',
        category: 'transfer_internal',
        categoryConfidence: 0.95,
        categorySource: 'rule',
        isInternalTransfer: true,
        internalTransferKind: 'other',
        internalTransferDirection: 'out',
        internalTransferGroupId: 'int_789',
      };

      const explanation = buildCategorizationExplanation(tx);
      expect(explanation.code).toBe('internal_transfer_other_out');
      expect(explanation.text).toContain('Internal transfer between own accounts');
    });
  });

  describe('reimbursements', () => {
    it('returns reimbursement_payer for payer role', () => {
      const tx: NormalizedTransaction = {
        id: '1',
        bookingDate: '2025-01-15',
        amountCents: -5000,
        currency: 'EUR',
        direction: 'out',
        rawText: 'Groceries',
        bankProfile: 'comdirect',
        category: 'groceries',
        categoryConfidence: 0.9,
        categorySource: 'rule',
        isReimbursement: true,
        reimbursementRole: 'payer',
        reimbursementGroupId: 'reimb_123',
      };

      const explanation = buildCategorizationExplanation(tx);
      expect(explanation.code).toBe('reimbursement_payer');
      expect(explanation.text).toContain('you paid and were reimbursed');
    });

    it('returns reimbursement_receiver for receiver role with ratio', () => {
      const tx: NormalizedTransaction = {
        id: '1',
        bookingDate: '2025-01-15',
        amountCents: 2500,
        currency: 'EUR',
        direction: 'in',
        rawText: 'Reimbursement',
        bankProfile: 'comdirect',
        category: 'other',
        categoryConfidence: 0.5,
        categorySource: 'fallback',
        isReimbursement: true,
        reimbursementRole: 'receiver',
        reimbursementGroupId: 'reimb_123',
        reimbursementShareRatio: 0.5,
      };

      const explanation = buildCategorizationExplanation(tx);
      expect(explanation.code).toBe('reimbursement_receiver');
      expect(explanation.text).toContain('Reimbursement received');
      expect(explanation.text).toContain('50%');
    });

    it('returns reimbursement_receiver for receiver role without ratio', () => {
      const tx: NormalizedTransaction = {
        id: '1',
        bookingDate: '2025-01-15',
        amountCents: 2500,
        currency: 'EUR',
        direction: 'in',
        rawText: 'Reimbursement',
        bankProfile: 'comdirect',
        category: 'other',
        categoryConfidence: 0.5,
        categorySource: 'fallback',
        isReimbursement: true,
        reimbursementRole: 'receiver',
        reimbursementGroupId: 'reimb_123',
      };

      const explanation = buildCategorizationExplanation(tx);
      expect(explanation.code).toBe('reimbursement_receiver');
      expect(explanation.text).toContain('Reimbursement received');
    });
  });

  describe('rule-based matches', () => {
    it('returns rule with ruleId when available', () => {
      const tx: NormalizedTransaction = {
        id: '1',
        bookingDate: '2025-01-15',
        amountCents: -2345,
        currency: 'EUR',
        direction: 'out',
        rawText: 'LIDL SAGT DANKE',
        bankProfile: 'comdirect',
        category: 'groceries',
        categoryConfidence: 0.95,
        categorySource: 'rule',
        categoryRuleId: 'supermarket:lidl',
      };

      const explanation = buildCategorizationExplanation(tx);
      expect(explanation.code).toBe('rule_supermarket:lidl');
      expect(explanation.text).toContain('Categorised by rule');
      expect(explanation.text).toContain('supermarket:lidl');
    });

    it('returns rule with category when ruleId not available', () => {
      const tx: NormalizedTransaction = {
        id: '1',
        bookingDate: '2025-01-15',
        amountCents: -2345,
        currency: 'EUR',
        direction: 'out',
        rawText: 'REWE',
        bankProfile: 'comdirect',
        category: 'groceries',
        categoryConfidence: 0.9,
        categorySource: 'rule',
      };

      const explanation = buildCategorizationExplanation(tx);
      expect(explanation.code).toBe('rule_groceries');
      expect(explanation.text).toContain('Categorised by rule');
    });
  });

  describe('merchant fuzzy matches', () => {
    it('returns merchant_fuzzy for merchant-db-fuzzy source', () => {
      const tx: NormalizedTransaction = {
        id: '1',
        bookingDate: '2025-01-15',
        amountCents: -2345,
        currency: 'EUR',
        direction: 'out',
        rawText: 'LIDL',
        bankProfile: 'comdirect',
        category: 'groceries',
        categoryConfidence: 0.85,
        categorySource: 'merchant-db-fuzzy',
      };

      const explanation = buildCategorizationExplanation(tx);
      expect(explanation.code).toBe('merchant_fuzzy');
      expect(explanation.text).toContain('Matched known merchant by similarity');
    });
  });

  describe('user rules', () => {
    it('returns user_rule for user source', () => {
      const tx: NormalizedTransaction = {
        id: '1',
        bookingDate: '2025-01-15',
        amountCents: -1000,
        currency: 'EUR',
        direction: 'out',
        rawText: 'Custom merchant',
        bankProfile: 'comdirect',
        category: 'other',
        categoryConfidence: 1.0,
        categorySource: 'user',
      };

      const explanation = buildCategorizationExplanation(tx);
      expect(explanation.code).toBe('user_rule');
      expect(explanation.text).toContain('Categorised by your custom rule');
    });

    it('returns user_rule for feedback source', () => {
      const tx: NormalizedTransaction = {
        id: '1',
        bookingDate: '2025-01-15',
        amountCents: -1000,
        currency: 'EUR',
        direction: 'out',
        rawText: 'User override',
        bankProfile: 'comdirect',
        category: 'groceries',
        categoryConfidence: 1.0,
        categorySource: 'feedback',
      };

      const explanation = buildCategorizationExplanation(tx);
      expect(explanation.code).toBe('user_rule');
      expect(explanation.text).toContain('Categorised by your custom rule');
    });
  });

  describe('heuristics', () => {
    it('returns heuristic_salary for heuristic:salary source', () => {
      const tx: NormalizedTransaction = {
        id: '1',
        bookingDate: '2025-01-15',
        amountCents: 250000,
        currency: 'EUR',
        direction: 'in',
        rawText: 'Gehalt',
        bankProfile: 'comdirect',
        category: 'income:salary',
        categoryConfidence: 0.95,
        categorySource: 'heuristic:salary',
      };

      const explanation = buildCategorizationExplanation(tx);
      expect(explanation.code).toBe('heuristic_salary');
      expect(explanation.text).toContain('Detected via heuristic pattern');
      expect(explanation.text).toContain('salary');
    });

    it('returns heuristic_rent for heuristic:rent source', () => {
      const tx: NormalizedTransaction = {
        id: '1',
        bookingDate: '2025-01-15',
        amountCents: -80000,
        currency: 'EUR',
        direction: 'out',
        rawText: 'Miete',
        bankProfile: 'comdirect',
        category: 'housing:rent',
        categoryConfidence: 0.9,
        categorySource: 'heuristic:rent',
      };

      const explanation = buildCategorizationExplanation(tx);
      expect(explanation.code).toBe('heuristic_rent');
      expect(explanation.text).toContain('Detected via heuristic pattern');
    });

    it('returns heuristic with category for generic heuristic source', () => {
      const tx: NormalizedTransaction = {
        id: '1',
        bookingDate: '2025-01-15',
        amountCents: -5000,
        currency: 'EUR',
        direction: 'out',
        rawText: 'Subscription',
        bankProfile: 'comdirect',
        category: 'subscriptions:telecom',
        categoryConfidence: 0.8,
        categorySource: 'heuristic',
      };

      const explanation = buildCategorizationExplanation(tx);
      expect(explanation.code).toBe('heuristic_subscriptions:telecom');
      expect(explanation.text).toContain('Detected via heuristic pattern');
    });
  });

  describe('fallback / Sonstiges', () => {
    it('returns fallback_other_no_match for other category', () => {
      const tx: NormalizedTransaction = {
        id: '1',
        bookingDate: '2025-01-15',
        amountCents: -1000,
        currency: 'EUR',
        direction: 'out',
        rawText: 'Unknown transaction',
        bankProfile: 'comdirect',
        category: 'other',
        categoryConfidence: 0.1,
        categorySource: 'fallback',
      };

      const explanation = buildCategorizationExplanation(tx);
      expect(explanation.code).toBe('fallback_other_no_match');
      expect(explanation.text).toContain('Other/uncategorized');
      expect(explanation.text).toContain('no rule or merchant match yet');
    });

    it('returns fallback_other_no_match for other_review category', () => {
      const tx: NormalizedTransaction = {
        id: '1',
        bookingDate: '2025-01-15',
        amountCents: -1000,
        currency: 'EUR',
        direction: 'out',
        rawText: 'Unknown transaction',
        bankProfile: 'comdirect',
        category: 'other_review',
        categoryConfidence: 0.1,
        categorySource: 'fallback',
      };

      const explanation = buildCategorizationExplanation(tx);
      expect(explanation.code).toBe('fallback_other_no_match');
      expect(explanation.text).toContain('Other/uncategorized');
    });
  });

  describe('priority order', () => {
    it('prioritizes refunds over internal transfers', () => {
      const tx: NormalizedTransaction = {
        id: '1',
        bookingDate: '2025-01-15',
        amountCents: 50000,
        currency: 'EUR',
        direction: 'in',
        rawText: 'Refund',
        bankProfile: 'comdirect',
        category: 'transfer_internal',
        categoryConfidence: 0.95,
        categorySource: 'rule',
        isRefund: true,
        isInternalTransfer: true,
        internalTransferKind: 'savings',
        internalTransferDirection: 'in',
      };

      const explanation = buildCategorizationExplanation(tx);
      expect(explanation.code).toBe('refund_pair');
    });

    it('prioritizes internal transfers over rule matches', () => {
      const tx: NormalizedTransaction = {
        id: '1',
        bookingDate: '2025-01-15',
        amountCents: -50000,
        currency: 'EUR',
        direction: 'out',
        rawText: 'Transfer to savings',
        bankProfile: 'comdirect',
        category: 'transfer_internal',
        categoryConfidence: 0.95,
        categorySource: 'rule',
        categoryRuleId: 'transfer:savings',
        isInternalTransfer: true,
        internalTransferKind: 'savings',
        internalTransferDirection: 'out',
      };

      const explanation = buildCategorizationExplanation(tx);
      expect(explanation.code).toBe('internal_transfer_savings_out');
    });
  });
});

