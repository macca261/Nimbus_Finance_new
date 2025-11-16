import { describe, it, expect } from 'vitest';

type Tx = { amount: number; amountCents?: number };

function canPair(a: Tx, b: Tx, toleranceCents = 100) {
  const aC = typeof a.amountCents === 'number' ? a.amountCents : Math.round(a.amount * 100);
  const bC = typeof b.amountCents === 'number' ? b.amountCents : Math.round(b.amount * 100);
  const opposite = (aC < 0 && bC > 0) || (aC > 0 && bC < 0);
  const diff = Math.abs(Math.abs(aC) - Math.abs(bC));
  return opposite && diff <= toleranceCents;
}

describe('Transactions selection pass-through predicate', () => {
  it('accepts opposite sign with same abs amount', () => {
    expect(canPair({ amountCents: +10000, amount: 100 }, { amountCents: -10000, amount: -100 })).toBe(true);
  });
  it('rejects same sign', () => {
    expect(canPair({ amountCents: +10000, amount: 100 }, { amountCents: +10000, amount: 100 })).toBe(false);
  });
  it('accepts within tolerance', () => {
    expect(canPair({ amountCents: +10050, amount: 100.5 }, { amountCents: -10000, amount: -100 })).toBe(true);
  });
  it('rejects outside tolerance', () => {
    expect(canPair({ amountCents: +10200, amount: 102 }, { amountCents: -10000, amount: -100 })).toBe(false);
  });
});


