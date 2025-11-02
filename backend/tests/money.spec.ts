import { describe, it, expect } from 'vitest';

function parseEuroToCents(input: string): number {
  const s = input.trim().replace(/\s+/g,'').replace('€','');
  const neg = s.startsWith('-') || s.endsWith('-') || /^\(.*\)$/.test(s);
  const cleaned = s.replace(/[()\-+]/g,'').replace(/\./g,'').replace(',', '.');
  const n = Math.round(parseFloat(cleaned) * 100);
  return neg ? -n : n;
}

describe('money', () => {
  it('parses thousand-comma euro', () => {
    expect(parseEuroToCents('1.234,56 €')).toBe(123456);
  });
  it('parses negatives', () => {
    expect(parseEuroToCents('-31,24')).toBe(-3124);
  });
});


