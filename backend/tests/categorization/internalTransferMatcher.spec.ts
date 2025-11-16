import { describe, expect, it } from 'vitest';
import { findInternalTransferPair, applyInternalTransferFlags } from '../../src/categorization/internalTransferMatcher';
import type { NormalizedCanonicalRow } from '../../src/db';

describe('internalTransferMatcher', () => {
  const createRow = (
    publicId: string,
    amountCents: number,
    counterpartName: string,
    bookingDate: string,
    accountId: string,
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
    isInternalTransfer: false,
    internalTransferDirection: null,
    internalTransferKind: null,
    internalTransferGroupId: null,
    createdAt: bookingDate,
    transactionPayload: {} as any,
  });

  describe('findInternalTransferPair', () => {
    it('pairs bank ↔ savings: same amount, opposite sign, contains "TAGESGELD", 1 day apart', () => {
      const out = createRow('out1', -50000, 'Übertrag auf Tagesgeldkonto', '2025-01-15', 'account:giro');
      const in_ = createRow('in1', 50000, 'Übertrag von Girokonto', '2025-01-16', 'account:savings');
      
      const match = findInternalTransferPair(out, [in_], { daysWindow: 3 });
      
      expect(match).not.toBeNull();
      expect(match?.kind).toBe('savings');
      expect(match?.directionForA).toBe('out');
      expect(match?.directionForB).toBe('in');
      expect(match?.groupId).toMatch(/^int_/);
    });

    it('pairs bank ↔ PayPal: both mention PAYPAL, same amount, opposite sign', () => {
      const out = createRow('out1', -4000, 'PayPal Aufladung', '2025-01-15', 'account:giro');
      const in_ = createRow('in1', 4000, 'PayPal Auszahlung', '2025-01-15', 'account:paypal');
      
      const match = findInternalTransferPair(out, [in_], { daysWindow: 3 });
      
      expect(match).not.toBeNull();
      expect(match?.kind).toBe('wallet');
      expect(match?.directionForA).toBe('out');
      expect(match?.directionForB).toBe('in');
    });

    it('does not pair different amount', () => {
      const out = createRow('out1', -50000, 'Übertrag auf Tagesgeldkonto', '2025-01-15', 'account:giro');
      const in_ = createRow('in1', 40000, 'Übertrag von Girokonto', '2025-01-16', 'account:savings');
      
      const match = findInternalTransferPair(out, [in_], { daysWindow: 3 });
      
      expect(match).toBeNull();
    });

    it('does not pair same amount, same sign', () => {
      const out1 = createRow('out1', -50000, 'Übertrag auf Tagesgeldkonto', '2025-01-15', 'account:giro');
      const out2 = createRow('out2', -50000, 'Übertrag auf Tagesgeldkonto', '2025-01-16', 'account:giro');
      
      const match = findInternalTransferPair(out1, [out2], { daysWindow: 3 });
      
      expect(match).toBeNull();
    });

    it('does not pair if already has isInternalTransfer set', () => {
      const out = createRow('out1', -50000, 'Übertrag auf Tagesgeldkonto', '2025-01-15', 'account:giro');
      out.isInternalTransfer = true;
      out.internalTransferGroupId = 'int_group_1';
      
      const in_ = createRow('in1', 50000, 'Übertrag von Girokonto', '2025-01-16', 'account:savings');
      
      const match = findInternalTransferPair(out, [in_], { daysWindow: 3 });
      
      expect(match).toBeNull();
    });

    it('does not pair if other already has isInternalTransfer set', () => {
      const out = createRow('out1', -50000, 'Übertrag auf Tagesgeldkonto', '2025-01-15', 'account:giro');
      const in_ = createRow('in1', 50000, 'Übertrag von Girokonto', '2025-01-16', 'account:savings');
      in_.isInternalTransfer = true;
      in_.internalTransferGroupId = 'int_group_1';
      
      const match = findInternalTransferPair(out, [in_], { daysWindow: 3 });
      
      expect(match).toBeNull();
    });

    it('does not pair outside date window (e.g. 5 days)', () => {
      const out = createRow('out1', -50000, 'Übertrag auf Tagesgeldkonto', '2025-01-15', 'account:giro');
      const in_ = createRow('in1', 50000, 'Übertrag von Girokonto', '2025-01-21', 'account:savings'); // 6 days later
      
      const match = findInternalTransferPair(out, [in_], { daysWindow: 3 });
      
      expect(match).toBeNull();
    });

    it('does not pair if same accountId (must be different accounts)', () => {
      const out = createRow('out1', -50000, 'Übertrag auf Tagesgeldkonto', '2025-01-15', 'account:giro');
      const in_ = createRow('in1', 50000, 'Übertrag von Girokonto', '2025-01-16', 'account:giro'); // Same account
      
      const match = findInternalTransferPair(out, [in_], { daysWindow: 3 });
      
      expect(match).toBeNull();
    });

    it('does not pair if text does not contain transfer keywords', () => {
      const out = createRow('out1', -50000, 'Regular Purchase', '2025-01-15', 'account:giro');
      const in_ = createRow('in1', 50000, 'Regular Income', '2025-01-16', 'account:savings');
      
      const match = findInternalTransferPair(out, [in_], { daysWindow: 3 });
      
      expect(match).toBeNull();
    });

    it('does not pair if candidate is part of refund pair', () => {
      const out = createRow('out1', -50000, 'Übertrag auf Tagesgeldkonto', '2025-01-15', 'account:giro');
      out.isRefunded = true;
      out.refundGroupId = 'refund_group_1';
      
      const in_ = createRow('in1', 50000, 'Übertrag von Girokonto', '2025-01-16', 'account:savings');
      
      const match = findInternalTransferPair(out, [in_], { daysWindow: 3 });
      
      expect(match).toBeNull();
    });
  });

  describe('applyInternalTransferFlags', () => {
    it('applies flags correctly to both rows', () => {
      const a = createRow('a1', -50000, 'Übertrag auf Tagesgeldkonto', '2025-01-15', 'account:giro');
      const b = createRow('b1', 50000, 'Übertrag von Girokonto', '2025-01-16', 'account:savings');
      
      const match = findInternalTransferPair(a, [b], { daysWindow: 3 });
      expect(match).not.toBeNull();
      
      const flagged = applyInternalTransferFlags(match!);
      
      expect(flagged.a.isInternalTransfer).toBe(true);
      expect(flagged.a.internalTransferDirection).toBe('out');
      expect(flagged.a.internalTransferKind).toBe('savings');
      expect(flagged.a.internalTransferGroupId).toBe(match!.groupId);
      
      expect(flagged.b.isInternalTransfer).toBe(true);
      expect(flagged.b.internalTransferDirection).toBe('in');
      expect(flagged.b.internalTransferKind).toBe('savings');
      expect(flagged.b.internalTransferGroupId).toBe(match!.groupId);
    });
  });
});

