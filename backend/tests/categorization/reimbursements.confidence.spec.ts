import { describe, it, expect, beforeEach } from 'vitest';
import { openDb, ensureSchema, insertTransactions } from '../helpers/db';
import type { Database } from '../../src/db';
import { computeReimbursementConfidence } from '../../src/categorization/reimbursementMatcher';

describe('Reimbursement Confidence Scoring', () => {
  let db: Database;

  beforeEach(() => {
    db = openDb(':memory:');
    ensureSchema(db);
  });

  describe('computeReimbursementConfidence', () => {
    it('should score high (≥90) for obvious refund with same merchant and amount', () => {
      const confidence = computeReimbursementConfidence({
        expenseRow: {
          amountCents: -10000, // -100.00 EUR
          bookingDate: '2025-01-15',
          counterpartName: 'Amazon',
          payee: null,
          purpose: 'Purchase',
          memo: null,
          category: 'shopping',
        },
        reimbursementRow: {
          amountCents: 10000, // +100.00 EUR
          bookingDate: '2025-01-15', // Same day
          counterpartName: 'Amazon',
          payee: null,
          purpose: 'Rückbuchung Amazon',
          memo: null,
          category: 'shopping',
        },
      });

      expect(confidence.total).toBeGreaterThanOrEqual(90);
      expect(confidence.counterpartyScore).toBe(30); // Exact match
      expect(confidence.timeScore).toBe(20); // Same day
      expect(confidence.amountScore).toBe(25); // 100% match
      expect(confidence.contextScore).toBeGreaterThan(0); // Same category
      expect(confidence.noteScore).toBeGreaterThan(0); // Has "Rückbuchung"
    });

    it('should score medium (60-90) for P2P PayPal reimbursement with reasonable timing and amount', () => {
      const confidence = computeReimbursementConfidence({
        expenseRow: {
          amountCents: -5000, // -50.00 EUR
          bookingDate: '2025-01-10',
          counterpartName: 'Pembe Aksoy',
          payee: null,
          purpose: 'Payment',
          memo: null,
          category: 'other',
        },
        reimbursementRow: {
          amountCents: 5500, // +55.00 EUR (110% of expense)
          bookingDate: '2025-01-12', // 2 days later
          counterpartName: 'Pembe Aksoy',
          payee: null,
          purpose: 'Erstattung PayPal',
          memo: null,
          category: 'other',
        },
      });

      expect(confidence.total).toBeGreaterThanOrEqual(60);
      expect(confidence.total).toBeLessThan(90);
      expect(confidence.counterpartyScore).toBe(30); // Exact match
      expect(confidence.timeScore).toBe(17); // 1-3 days
      expect(confidence.amountScore).toBe(18); // 80-120% range
      expect(confidence.noteScore).toBeGreaterThan(0); // Has "Erstattung"
    });

    it('should score low (<40) for weak candidate with wrong counterparty, far timing, different amount', () => {
      const confidence = computeReimbursementConfidence({
        expenseRow: {
          amountCents: -20000, // -200.00 EUR
          bookingDate: '2025-01-01',
          counterpartName: 'Amazon',
          payee: null,
          purpose: 'Purchase',
          memo: null,
          category: 'shopping',
        },
        reimbursementRow: {
          amountCents: 5000, // +50.00 EUR (only 25% of expense)
          bookingDate: '2025-02-15', // 45 days later
          counterpartName: 'Different Merchant',
          payee: null,
          purpose: 'Payment',
          memo: null,
          category: 'other',
        },
      });

      expect(confidence.total).toBeLessThan(40);
      expect(confidence.counterpartyScore).toBe(0); // No match
      expect(confidence.timeScore).toBe(0); // >30 days
      expect(confidence.amountScore).toBe(0); // <50% ratio
    });

    it('should handle fuzzy counterparty matching', () => {
      const confidence = computeReimbursementConfidence({
        expenseRow: {
          amountCents: -10000,
          bookingDate: '2025-01-15',
          counterpartName: 'Amazon DE',
          payee: null,
          purpose: 'Purchase',
          memo: null,
          category: 'shopping',
        },
        reimbursementRow: {
          amountCents: 10000,
          bookingDate: '2025-01-15',
          counterpartName: 'Amazon',
          payee: null,
          purpose: 'Rückbuchung',
          memo: null,
          category: 'shopping',
        },
      });

      // Should get fuzzy match score (20) if one contains the other
      expect(confidence.counterpartyScore).toBeGreaterThanOrEqual(20);
    });

    it('should score time differences correctly', () => {
      const baseExpense = {
        amountCents: -10000,
        counterpartName: 'Test',
        payee: null,
        purpose: 'Test',
        memo: null,
        category: 'other',
      };

      const baseReimbursement = {
        amountCents: 10000,
        counterpartName: 'Test',
        payee: null,
        purpose: 'Rückbuchung',
        memo: null,
        category: 'other',
      };

      // Same day
      const sameDay = computeReimbursementConfidence({
        expenseRow: { ...baseExpense, bookingDate: '2025-01-15' },
        reimbursementRow: { ...baseReimbursement, bookingDate: '2025-01-15' },
      });
      expect(sameDay.timeScore).toBe(20);

      // 2 days
      const twoDays = computeReimbursementConfidence({
        expenseRow: { ...baseExpense, bookingDate: '2025-01-15' },
        reimbursementRow: { ...baseReimbursement, bookingDate: '2025-01-17' },
      });
      expect(twoDays.timeScore).toBe(17);

      // 5 days
      const fiveDays = computeReimbursementConfidence({
        expenseRow: { ...baseExpense, bookingDate: '2025-01-15' },
        reimbursementRow: { ...baseReimbursement, bookingDate: '2025-01-20' },
      });
      expect(fiveDays.timeScore).toBe(12);

      // 10 days
      const tenDays = computeReimbursementConfidence({
        expenseRow: { ...baseExpense, bookingDate: '2025-01-15' },
        reimbursementRow: { ...baseReimbursement, bookingDate: '2025-01-25' },
      });
      expect(tenDays.timeScore).toBe(8);

      // 20 days
      const twentyDays = computeReimbursementConfidence({
        expenseRow: { ...baseExpense, bookingDate: '2025-01-15' },
        reimbursementRow: { ...baseReimbursement, bookingDate: '2025-02-04' },
      });
      expect(twentyDays.timeScore).toBe(5);

      // 35 days
      const thirtyFiveDays = computeReimbursementConfidence({
        expenseRow: { ...baseExpense, bookingDate: '2025-01-15' },
        reimbursementRow: { ...baseReimbursement, bookingDate: '2025-02-19' },
      });
      expect(thirtyFiveDays.timeScore).toBe(0);
    });

    it('should score amount correlations correctly', () => {
      const base = {
        bookingDate: '2025-01-15',
        counterpartName: 'Test',
        payee: null,
        purpose: 'Test',
        memo: null,
        category: 'other',
      };

      // 100% match
      const exact = computeReimbursementConfidence({
        expenseRow: { ...base, amountCents: -10000 },
        reimbursementRow: { ...base, amountCents: 10000 },
      });
      expect(exact.amountScore).toBe(25);

      // 98% match (within 95-105%)
      const nearExact = computeReimbursementConfidence({
        expenseRow: { ...base, amountCents: -10000 },
        reimbursementRow: { ...base, amountCents: 9800 },
      });
      expect(nearExact.amountScore).toBe(25);

      // 110% match (within 80-120%)
      const slightlyOver = computeReimbursementConfidence({
        expenseRow: { ...base, amountCents: -10000 },
        reimbursementRow: { ...base, amountCents: 11000 },
      });
      expect(slightlyOver.amountScore).toBe(18);

      // 70% match (within 50-150%)
      const partial = computeReimbursementConfidence({
        expenseRow: { ...base, amountCents: -10000 },
        reimbursementRow: { ...base, amountCents: 7000 },
      });
      expect(partial.amountScore).toBe(10);

      // 30% match (outside 50-150%)
      const tooLow = computeReimbursementConfidence({
        expenseRow: { ...base, amountCents: -10000 },
        reimbursementRow: { ...base, amountCents: 3000 },
      });
      expect(tooLow.amountScore).toBe(0);
    });

    it('should score note keywords correctly', () => {
      const base = {
        amountCents: -10000,
        bookingDate: '2025-01-15',
        counterpartName: 'Test',
        payee: null,
        memo: null,
        category: 'other',
      };

      // 3+ keywords
      const manyKeywords = computeReimbursementConfidence({
        expenseRow: { ...base, purpose: 'Purchase' },
        reimbursementRow: {
          ...base,
          amountCents: 10000,
          purpose: 'Rückbuchung Erstattung Gutschrift',
        },
      });
      expect(manyKeywords.noteScore).toBe(10);

      // 2 keywords
      const twoKeywords = computeReimbursementConfidence({
        expenseRow: { ...base, purpose: 'Purchase' },
        reimbursementRow: {
          ...base,
          amountCents: 10000,
          purpose: 'Rückbuchung Erstattung',
        },
      });
      expect(twoKeywords.noteScore).toBe(7);

      // 1 keyword
      const oneKeyword = computeReimbursementConfidence({
        expenseRow: { ...base, purpose: 'Purchase' },
        reimbursementRow: {
          ...base,
          amountCents: 10000,
          purpose: 'Erstattung',
        },
      });
      expect(oneKeyword.noteScore).toBe(4);

      // 0 keywords
      const noKeywords = computeReimbursementConfidence({
        expenseRow: { ...base, purpose: 'Purchase' },
        reimbursementRow: {
          ...base,
          amountCents: 10000,
          purpose: 'Payment',
        },
      });
      expect(noKeywords.noteScore).toBe(0);
    });

    it('should clamp total score to 0-100', () => {
      // Test that scores are always within bounds
      const confidence = computeReimbursementConfidence({
        expenseRow: {
          amountCents: -10000,
          bookingDate: '2025-01-15',
          counterpartName: 'Test',
          payee: null,
          purpose: 'Test',
          memo: null,
          category: 'other',
        },
        reimbursementRow: {
          amountCents: 10000,
          bookingDate: '2025-01-15',
          counterpartName: 'Test',
          payee: null,
          purpose: 'Rückbuchung Erstattung Gutschrift',
          memo: null,
          category: 'other',
        },
      });

      expect(confidence.total).toBeGreaterThanOrEqual(0);
      expect(confidence.total).toBeLessThanOrEqual(100);
    });
  });
});

