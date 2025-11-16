import { describe, it, expect } from 'vitest';
import { categorizeTransaction } from '../../src/categorization';
import type { ParsedRow } from '../../src/parser/types';

function makeRow(overrides: Partial<ParsedRow>): ParsedRow {
  return {
    id: 'tx-1',
    bookingDate: '2025-11-05',
    valueDate: '2025-11-05',
    amountCents: -12345,
    currency: 'EUR',
    rawText: 'Übertrag an Tagesgeld',
    counterparty: 'Ich selbst',
    direction: 'out',
    category: undefined as any,
    categoryConfidence: undefined as any,
    categorySource: undefined as any,
    source: 'manual',
    sourceProfile: 'comdirect',
    accountId: 'A',
    ...overrides,
  } as any;
}

describe('Internal transfer categories override', () => {
  it('savings transfer (paired) is forced to internal:transfer_savings', () => {
    const row = makeRow({
      isInternalTransfer: true as any,
      internalTransferKind: 'savings' as any,
      internalTransferDirection: 'out' as any,
      rawText: 'Übertrag an Tagesgeld Konto',
    });
    const res = categorizeTransaction(row);
    expect(res.category).toBe('internal:transfer_savings');
    expect(res.source).toBe('rule'); // mapped from system to rule in index.ts
  });

  it('single-sided savings is forced to internal:transfer_savings', () => {
    const row = makeRow({
      isInternalTransfer: true as any,
      internalTransferKind: 'savings' as any,
      internalTransferDirection: 'out' as any,
      rawText: 'Überweisung an Sparkonto',
    });
    const res = categorizeTransaction(row);
    expect(res.category).toBe('internal:transfer_savings');
  });

  it('generic internal transfer becomes internal:transfer_other', () => {
    const row = makeRow({
      isInternalTransfer: true as any,
      internalTransferKind: 'other' as any,
      internalTransferDirection: 'out' as any,
      rawText: 'Interne Umbuchung',
    });
    const res = categorizeTransaction(row);
    expect(res.category).toBe('internal:transfer_other');
  });

  it('internal transfers never become transport even with transport keywords', () => {
    const row = makeRow({
      isInternalTransfer: true as any,
      internalTransferKind: 'savings' as any,
      internalTransferDirection: 'out' as any,
      rawText: 'DB ÖPNV Ticket Umbuchung',
    });
    const res = categorizeTransaction(row);
    expect(res.category).toBe('internal:transfer_savings');
  });

  it('external transport stays transport when not internal', () => {
    const row = makeRow({
      isInternalTransfer: false as any,
      internalTransferKind: null as any,
      rawText: 'Deutsche Bahn ICE Ticket',
      amountCents: -4500,
    });
    const res = categorizeTransaction(row);
    expect(res.category.startsWith('transport')).toBe(true);
  });
});


