import { describe, expect, it } from 'vitest';
import { findRefundPair, linkRefundPair } from '../../src/categorization/refundMatcher';
import type { NormalizedCanonicalRow } from '../../src/db';

describe('refundMatcher', () => {
  const createRow = (
    publicId: string,
    amountCents: number,
    counterpartName: string,
    bookingDate: string,
    accountId: string = 'test:account',
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
    category: null,
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
    createdAt: bookingDate,
    transactionPayload: {} as any,
  });

  describe('findRefundPair', () => {
    it('pairs same merchant, same amount, opposite sign, within 30 days', () => {
      const charge = createRow('charge1', -2900, 'EUROP ASSISTANCE, PARIS FR', '2025-01-15', 'test:account');
      const refund = createRow('refund1', 2900, 'EUROP ASSISTANCE, PARIS FR', '2025-01-20', 'test:account');
      
      const existing = [charge];
      const match = findRefundPair(refund, existing, { daysWindow: 90 });
      
      expect(match).not.toBeNull();
      expect(match?.publicId).toBe('charge1');
    });

    it('does not pair different merchant, same amount', () => {
      const charge = createRow('charge1', -2900, 'EUROP ASSISTANCE, PARIS FR', '2025-01-15', 'test:account');
      const refund = createRow('refund1', 2900, 'DIFFERENT MERCHANT', '2025-01-20', 'test:account');
      
      const existing = [charge];
      const match = findRefundPair(refund, existing, { daysWindow: 90 });
      
      expect(match).toBeNull();
    });

    it('does not pair same merchant, different amount', () => {
      const charge = createRow('charge1', -2900, 'EUROP ASSISTANCE, PARIS FR', '2025-01-15', 'test:account');
      const refund = createRow('refund1', 3000, 'EUROP ASSISTANCE, PARIS FR', '2025-01-20', 'test:account');
      
      const existing = [charge];
      const match = findRefundPair(refund, existing, { daysWindow: 90 });
      
      expect(match).toBeNull();
    });

    it('does not pair older than 90 days', () => {
      const charge = createRow('charge1', -2900, 'EUROP ASSISTANCE, PARIS FR', '2024-10-01', 'test:account');
      const refund = createRow('refund1', 2900, 'EUROP ASSISTANCE, PARIS FR', '2025-01-20', 'test:account');
      
      const existing = [charge];
      const match = findRefundPair(refund, existing, { daysWindow: 90 });
      
      expect(match).toBeNull();
    });

    it('does not pair if charge already has isRefunded set', () => {
      const charge = createRow('charge1', -2900, 'EUROP ASSISTANCE, PARIS FR', '2025-01-15', 'test:account');
      charge.isRefunded = true;
      charge.refundGroupId = 'refund_group_1';
      
      const refund = createRow('refund1', 2900, 'EUROP ASSISTANCE, PARIS FR', '2025-01-20', 'test:account');
      
      const existing = [charge];
      const match = findRefundPair(refund, existing, { daysWindow: 90 });
      
      expect(match).toBeNull();
    });

    it('does not pair if refund already has isRefund set', () => {
      const charge = createRow('charge1', -2900, 'EUROP ASSISTANCE, PARIS FR', '2025-01-15', 'test:account');
      const refund = createRow('refund1', 2900, 'EUROP ASSISTANCE, PARIS FR', '2025-01-20', 'test:account');
      refund.isRefund = true;
      refund.refundGroupId = 'refund_group_1';
      
      const existing = [charge];
      const match = findRefundPair(refund, existing, { daysWindow: 90 });
      
      expect(match).toBeNull();
    });

    it('does not pair if different accountId', () => {
      const charge = createRow('charge1', -2900, 'EUROP ASSISTANCE, PARIS FR', '2025-01-15', 'account1');
      const refund = createRow('refund1', 2900, 'EUROP ASSISTANCE, PARIS FR', '2025-01-20', 'account2');
      
      const existing = [charge];
      const match = findRefundPair(refund, existing, { daysWindow: 90 });
      
      expect(match).toBeNull();
    });
  });

  describe('linkRefundPair', () => {
    it('correctly identifies charge (negative) and refund (positive)', () => {
      const charge = createRow('charge1', -2900, 'EUROP ASSISTANCE, PARIS FR', '2025-01-15', 'test:account');
      const refund = createRow('refund1', 2900, 'EUROP ASSISTANCE, PARIS FR', '2025-01-20', 'test:account');
      
      const linked = linkRefundPair(charge, refund);
      
      expect(linked.charge.publicId).toBe('charge1');
      expect(linked.charge.isRefunded).toBe(true);
      expect(linked.charge.isRefund).toBe(false);
      expect(linked.refund.publicId).toBe('refund1');
      expect(linked.refund.isRefund).toBe(true);
      expect(linked.refund.isRefunded).toBe(false);
      expect(linked.charge.refundGroupId).toBe(linked.refund.refundGroupId);
      expect(linked.refundGroupId).toMatch(/^refund_/);
    });

    it('generates deterministic refundGroupId', () => {
      const charge = createRow('charge1', -2900, 'EUROP ASSISTANCE, PARIS FR', '2025-01-15', 'test:account');
      const refund = createRow('refund1', 2900, 'EUROP ASSISTANCE, PARIS FR', '2025-01-20', 'test:account');
      
      const linked1 = linkRefundPair(charge, refund);
      const linked2 = linkRefundPair(refund, charge); // Reverse order
      
      expect(linked1.refundGroupId).toBe(linked2.refundGroupId);
    });
  });
});

