import { describe, expect, it } from 'vitest';

import type { ParsedRow } from '../src/parser/types';
import { setOverride, clearOverride } from '../src/categorization/overrides';
import { categorizeTransaction } from '../src/categorization/orchestrator';

const baseRow: ParsedRow = {
  bookingDate: '2025-08-01',
  valutaDate: '2025-08-01',
  amountCents: -879,
  currency: 'EUR',
  direction: 'out',
  accountIban: null,
  accountId: 'test:acct',
  counterparty: 'Uber BV',
  counterpartyIban: null,
  mcc: null,
  reference: null,
  rawText: 'Zahlung im Einzugsverfahren UBER BV',
  raw: { __source: 'spec' },
};

function withExternalId(id: string): ParsedRow {
  return {
    ...baseRow,
    raw: { ...baseRow.raw, externalId: id },
  };
}

describe('categorization overrides precedence', () => {
  it('user override beats rule-based categorization', async () => {
    const id = 'override-user-1';
    const row = withExternalId(id);

    await setOverride(id, 'shopping.online');
    const categorized = await categorizeTransaction(row);

    expect(categorized.category).toBe('shopping.online');
    expect(categorized.categorySource).toBe('user');
    await clearOverride(id);
  });

  it('falls back to rule when no override exists', async () => {
    const id = 'override-user-2';
    await clearOverride(id);
    const row = withExternalId(id);

    const categorized = await categorizeTransaction(row);
    expect(categorized.categorySource).toBe('rule');
  });
});


