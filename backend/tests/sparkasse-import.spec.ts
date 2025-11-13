import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { isProfileCsvText, parseWithProfile } from '../src/parsing/profileEngine';
import { sparkasseProfile } from '../src/parsing/profiles/sparkasse';

const fixturePath = (...segments: string[]) => path.join(__dirname, 'fixtures', ...segments);
const readFixtureBuffer = (...segments: string[]): Buffer => fs.readFileSync(fixturePath(...segments));

describe('Sparkasse profile detection', () => {
  it('detects the Sparkasse minimal export', () => {
    const buffer = readFixtureBuffer('DE', 'sparkasse_min.csv');
    expect(isProfileCsvText(buffer, sparkasseProfile)).toBe(true);
  });

  it('does not mis-detect PayPal exports', () => {
    const buffer = readFixtureBuffer('paypal_min.csv');
    expect(isProfileCsvText(buffer, sparkasseProfile)).toBe(false);
  });
});

describe('parseWithProfile (Sparkasse)', () => {
  const buffer = readFixtureBuffer('DE', 'sparkasse_min.csv');
  const result = parseWithProfile(buffer, sparkasseProfile);

  it('parses rows with ISO dates', () => {
    expect(result.rows.length).toBeGreaterThan(0);
    result.rows.forEach(row => {
      expect(/^\d{4}-\d{2}-\d{2}$/.test(row.bookingDate)).toBe(true);
      if (row.valutaDate) {
        expect(/^\d{4}-\d{2}-\d{2}$/.test(row.valutaDate)).toBe(true);
      }
    });
  });

  it('derives opening and closing balances from saldo column', () => {
    expect(result.openingBalance).toBeDefined();
    expect(result.closingBalance).toBeDefined();
    expect(result.openingBalance).toBeCloseTo(5000);
    expect(result.closingBalance).toBeCloseTo(4954.33, 2);
  });

  it('derives account identifiers with the sparkasse: prefix', () => {
    expect(result.rows.every(row => row.accountId.startsWith('sparkasse:'))).toBe(true);
  });
});


