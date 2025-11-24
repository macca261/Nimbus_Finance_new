import { describe, it, expect } from 'vitest';
import { redactTransactionForAi } from '../redactTransactionForAi';
import type { NormalizedTransaction } from '../../types/transactions';

describe('redactTransactionForAi', () => {
  const baseTransaction: NormalizedTransaction = {
    id: '1',
    bookingDate: '2024-01-15',
    amountCents: -5000,
    currency: 'EUR',
    direction: 'out',
    rawText: 'Test transaction',
    bankProfile: 'test',
    category: 'other',
    categoryConfidence: 0.5,
    categorySource: 'fallback',
  };

  it('redacts IBANs from description', () => {
    const tx: NormalizedTransaction = {
      ...baseTransaction,
      rawText: 'Lastschrift DE89370400440532013000',
      counterpartyIban: 'DE89370400440532013000',
    };

    const redacted = redactTransactionForAi(tx);
    expect(redacted.description).not.toContain('DE89370400440532013000');
    expect(redacted.description).toContain('****');
  });

  it('redacts card numbers', () => {
    const tx: NormalizedTransaction = {
      ...baseTransaction,
      rawText: 'Payment with card 1234 5678 9012 3456',
    };

    const redacted = redactTransactionForAi(tx);
    expect(redacted.description).not.toContain('1234');
    expect(redacted.description).not.toContain('5678');
    expect(redacted.description).toContain('****');
  });

  it('redacts long digit sequences', () => {
    const tx: NormalizedTransaction = {
      ...baseTransaction,
      rawText: 'Reference number 1234567890123456',
    };

    const redacted = redactTransactionForAi(tx);
    expect(redacted.description).not.toContain('1234567890123456');
    expect(redacted.description).toContain('****');
  });

  it('redacts email addresses', () => {
    const tx: NormalizedTransaction = {
      ...baseTransaction,
      rawText: 'Payment from user@example.com',
      counterparty: 'user@example.com',
    };

    const redacted = redactTransactionForAi(tx);
    expect(redacted.description).not.toContain('user@example.com');
    expect(redacted.description).toContain('****');
  });

  it('preserves merchant names and transaction purpose', () => {
    const tx: NormalizedTransaction = {
      ...baseTransaction,
      rawText: 'Amazon Purchase',
      counterparty: 'Amazon',
    };

    const redacted = redactTransactionForAi(tx);
    expect(redacted.description).toContain('Amazon');
    expect(redacted.description).toContain('Purchase');
  });

  it('combines multiple fields into description', () => {
    const tx: NormalizedTransaction = {
      ...baseTransaction,
      rawText: 'Grocery shopping',
      counterparty: 'REWE',
      memo: 'Weekly groceries',
    };

    const redacted = redactTransactionForAi(tx);
    expect(redacted.description).toContain('Grocery shopping');
    expect(redacted.description).toContain('REWE');
    expect(redacted.description).toContain('Weekly groceries');
  });

  it('converts amount from cents to euros', () => {
    const tx: NormalizedTransaction = {
      ...baseTransaction,
      amountCents: -5000,
    };

    const redacted = redactTransactionForAi(tx);
    expect(redacted.amount).toBe(-50.0);
  });

  it('preserves direction', () => {
    const txIn: NormalizedTransaction = {
      ...baseTransaction,
      direction: 'in',
      amountCents: 10000,
    };

    const txOut: NormalizedTransaction = {
      ...baseTransaction,
      direction: 'out',
      amountCents: -5000,
    };

    expect(redactTransactionForAi(txIn).direction).toBe('in');
    expect(redactTransactionForAi(txOut).direction).toBe('out');
  });

  it('preserves date', () => {
    const tx: NormalizedTransaction = {
      ...baseTransaction,
      bookingDate: '2024-12-25',
    };

    const redacted = redactTransactionForAi(tx);
    expect(redacted.date).toBe('2024-12-25');
  });

  it('handles transactions with no counterparty', () => {
    const tx: NormalizedTransaction = {
      ...baseTransaction,
      rawText: 'ATM withdrawal',
      counterparty: null,
      payee: null,
    };

    const redacted = redactTransactionForAi(tx);
    expect(redacted.description).toBe('ATM withdrawal');
  });

  it('redacts multiple sensitive patterns in one text', () => {
    const tx: NormalizedTransaction = {
      ...baseTransaction,
      rawText: 'Payment from user@example.com to DE89370400440532013000 with card 1234 5678 9012 3456',
    };

    const redacted = redactTransactionForAi(tx);
    expect(redacted.description).not.toContain('user@example.com');
    expect(redacted.description).not.toContain('DE89370400440532013000');
    expect(redacted.description).not.toContain('1234');
    // Should contain multiple masked sections
    const maskedCount = (redacted.description.match(/\*\*\*\*/g) || []).length;
    expect(maskedCount).toBeGreaterThan(0);
  });
});

