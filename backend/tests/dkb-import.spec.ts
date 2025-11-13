import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { isProfileCsvText, parseWithProfile } from '../src/parsing/profileEngine';
import { dkbProfile } from '../src/parsing/profiles/dkb';

const fixturePath = (...segments: string[]) => path.join(__dirname, 'fixtures', ...segments);
const readFixtureBuffer = (...segments: string[]): Buffer => fs.readFileSync(fixturePath(...segments));

describe('DKB profile detection', () => {
  it('detects the DKB minimal export', () => {
    const buffer = readFixtureBuffer('DE', 'dkb_min.csv');
    expect(isProfileCsvText(buffer, dkbProfile)).toBe(true);
  });

  it('does not mis-detect PayPal exports', () => {
    const buffer = readFixtureBuffer('paypal_min.csv');
    expect(isProfileCsvText(buffer, dkbProfile)).toBe(false);
  });
});

describe('parseWithProfile (DKB)', () => {
  const buffer = readFixtureBuffer('DE', 'dkb_min.csv');
  const result = parseWithProfile(buffer, dkbProfile);

  it('maps booking and valuta dates to ISO format', () => {
    expect(result.rows.length).toBeGreaterThan(0);
    result.rows.forEach(row => {
      expect(/^\d{4}-\d{2}-\d{2}$/.test(row.bookingDate)).toBe(true);
      expect(row.valutaDate).toBeDefined();
      if (row.valutaDate) {
        expect(/^\d{4}-\d{2}-\d{2}$/.test(row.valutaDate)).toBe(true);
      }
    });
  });

  it('derives account identifiers with the dkb: prefix', () => {
    expect(result.rows.every(row => row.accountId.startsWith('dkb:'))).toBe(true);
  });

  it('parses signed amounts via credit/debit columns when needed', () => {
    const directions = new Set(result.rows.map(row => row.direction));
    expect(directions.has('in')).toBe(true);
    expect(directions.has('out')).toBe(true);
  });

  it('emits deterministic metadata', () => {
    expect(result.profileId).toBe('dkb');
    expect(result.candidates).toEqual([{ profileId: 'dkb', confidence: 1 }]);
  });
});


