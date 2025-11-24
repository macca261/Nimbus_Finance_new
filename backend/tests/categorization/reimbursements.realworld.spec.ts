import { describe, it, expect, beforeEach } from 'vitest';
import { classifyReimbursementLike } from '../../src/categorization/reimbursementMatcher';
import type { NormalizedCanonicalRow } from '../../src/db';

describe('Reimbursement detection – real-world patterns', () => {
  const createRow = (
    publicId: string,
    amountCents: number,
    purpose: string,
    counterpartName: string,
    bookingDate: string,
    accountId: string,
  ): NormalizedCanonicalRow => ({
    publicId,
    bookingDate,
    valueDate: bookingDate,
    amountCents,
    currency: 'EUR',
    purpose,
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
    memo: purpose,
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

  describe('PayPal refund detection', () => {
    it('detects PayPal refund with "Rückbuchung PayPal" pattern', () => {
      const expense = createRow(
        'exp1',
        -5000,
        'PAYPAL P2P MAXINE',
        'Maxine',
        '2025-01-15',
        'account:giro',
      );
      const refund = createRow(
        'inc1',
        5000,
        'Rückbuchung PayPal P2P_AUTO_CANCEL',
        'PayPal',
        '2025-01-16',
        'account:giro',
      );

      const result = classifyReimbursementLike(refund, { recentTransactions: [expense] });

      expect(result).not.toBeNull();
      expect(result?.isReimbursement).toBe(true);
      expect(result?.reimbursementRole).toBe('receiver');
      expect(result?.reimbursementGroupId).toBeTruthy();
    });

    it('detects PayPal refund with "ERSTATTUNG PAYPAL" pattern', () => {
      const refund = createRow(
        'inc1',
        3000,
        'ERSTATTUNG PAYPAL',
        'PayPal',
        '2025-01-16',
        'account:giro',
      );

      const result = classifyReimbursementLike(refund);

      expect(result).not.toBeNull();
      expect(result?.isReimbursement).toBe(true);
      expect(result?.reimbursementRole).toBe('receiver');
    });

    it('detects refund with "GUTSCHRIFT" keyword', () => {
      const refund = createRow(
        'inc1',
        2000,
        'GUTSCHRIFT',
        'Bank',
        '2025-01-16',
        'account:giro',
      );

      const result = classifyReimbursementLike(refund);

      expect(result).not.toBeNull();
      expect(result?.isReimbursement).toBe(true);
      expect(result?.reimbursementRole).toBe('receiver');
    });
  });

  describe('P2P reimbursement detection (Pembe Aksoy style)', () => {
    it('detects P2P reimbursement when same name appears as expense then income', () => {
      const expense = createRow(
        'exp1',
        -10000,
        'Handyzahlung Pembe Aksoy',
        'Pembe Aksoy',
        '2025-01-15',
        'account:giro',
      );
      const reimbursement = createRow(
        'inc1',
        10000,
        'Pembe Aksoy',
        'Pembe Aksoy',
        '2025-01-20',
        'account:giro',
      );

      const result = classifyReimbursementLike(reimbursement, {
        recentTransactions: [expense],
        daysWindow: 30,
      });

      expect(result).not.toBeNull();
      expect(result?.isReimbursement).toBe(true);
      expect(result?.reimbursementRole).toBe('receiver');
      expect(result?.reimbursementGroupId).toBeTruthy();
    });

    it('does not match if names are different', () => {
      const expense = createRow(
        'exp1',
        -10000,
        'Handyzahlung Pembe Aksoy',
        'Pembe Aksoy',
        '2025-01-15',
        'account:giro',
      );
      const income = createRow(
        'inc1',
        10000,
        'Max Mustermann',
        'Max Mustermann',
        '2025-01-20',
        'account:giro',
      );

      const result = classifyReimbursementLike(income, {
        recentTransactions: [expense],
        daysWindow: 30,
      });

      // Should not match by name alone (no keywords)
      expect(result).toBeNull();
    });

    it('does not match if outside time window', () => {
      const expense = createRow(
        'exp1',
        -10000,
        'Handyzahlung Pembe Aksoy',
        'Pembe Aksoy',
        '2025-01-15',
        'account:giro',
      );
      const reimbursement = createRow(
        'inc1',
        10000,
        'Pembe Aksoy',
        'Pembe Aksoy',
        '2025-03-20', // 64 days later
        'account:giro',
      );

      const result = classifyReimbursementLike(reimbursement, {
        recentTransactions: [expense],
        daysWindow: 30,
      });

      expect(result).toBeNull();
    });
  });

  describe('Non-reimbursement noise', () => {
    it('does not flag normal salary as reimbursement', () => {
      const salary = createRow(
        'inc1',
        500000,
        'Gehalt',
        'Arbeitgeber GmbH',
        '2025-01-01',
        'account:giro',
      );

      const result = classifyReimbursementLike(salary);

      expect(result).toBeNull();
    });

    it('does not flag generic transfer without keywords', () => {
      const transfer = createRow(
        'inc1',
        10000,
        'Überweisung',
        'Unbekannt',
        '2025-01-01',
        'account:giro',
      );

      const result = classifyReimbursementLike(transfer);

      expect(result).toBeNull();
    });
  });

  describe('Internal transfers vs reimbursements', () => {
    it('does not flag internal transfer as reimbursement', () => {
      const transfer = createRow(
        'tx1',
        -50000,
        'Übertrag auf Sparkonto',
        'Aaron McIntosh',
        '2025-01-15',
        'account:giro',
      );
      transfer.isInternalTransfer = true;
      transfer.internalTransferGroupId = 'int_123';

      const result = classifyReimbursementLike(transfer);

      expect(result).toBeNull();
    });

    it('does not flag refund as reimbursement', () => {
      const refund = createRow(
        'inc1',
        5000,
        'Rückerstattung',
        'Händler',
        '2025-01-16',
        'account:giro',
      );
      refund.isRefund = true;
      refund.refundGroupId = 'ref_123';

      const result = classifyReimbursementLike(refund);

      expect(result).toBeNull();
    });
  });

  describe('Outgoing reimbursements (conservative)', () => {
    it('marks outgoing reimbursement if matching income was already marked', () => {
      const income = createRow(
        'inc1',
        10000,
        'Rückbuchung PayPal',
        'Pembe Aksoy',
        '2025-01-20',
        'account:giro',
      );
      income.isReimbursement = true;
      income.reimbursementRole = 'receiver';
      income.reimbursementGroupId = 'rb_123';

      const outgoing = createRow(
        'exp1',
        -10000,
        'Pembe Aksoy',
        'Pembe Aksoy',
        '2025-01-15',
        'account:giro',
      );

      const result = classifyReimbursementLike(outgoing, {
        recentTransactions: [income],
        daysWindow: 30,
      });

      expect(result).not.toBeNull();
      expect(result?.isReimbursement).toBe(true);
      expect(result?.reimbursementRole).toBe('payer');
      expect(result?.reimbursementGroupId).toBe('rb_123');
    });

    it('does not mark outgoing if income is not yet marked as reimbursement', () => {
      const income = createRow(
        'inc1',
        10000,
        'Pembe Aksoy',
        'Pembe Aksoy',
        '2025-01-20',
        'account:giro',
      );
      // Not marked as reimbursement yet

      const outgoing = createRow(
        'exp1',
        -10000,
        'Pembe Aksoy',
        'Pembe Aksoy',
        '2025-01-15',
        'account:giro',
      );

      const result = classifyReimbursementLike(outgoing, {
        recentTransactions: [income],
        daysWindow: 30,
      });

      // Should not mark outgoing unless income is already marked
      expect(result).toBeNull();
    });
  });
});

