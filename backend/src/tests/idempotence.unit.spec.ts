import { describe, it, expect } from 'vitest';
import { computeStableTxId } from '../providers/abstract';

describe('stable id', () => {
  const base = {
    accountId: 'a1',
    bookingDate: '2025-10-01',
    amount: -12.34,
    currency: 'EUR',
    purpose: 'REWE MARKT'
  } as any;

  it('is stable across whitespace/case changes in purpose', () => {
    const id1 = computeStableTxId(base);
    const id2 = computeStableTxId({ ...base, purpose: 'rewe   markt  ' });
    expect(id1).toEqual(id2);
  });
});


