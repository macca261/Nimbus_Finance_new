import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { isProfileCsvText, parseWithProfile } from '../src/parsing/profileEngine';
import { commerzbankProfile } from '../src/parsing/profiles/commerzbank';

const fixturePath = (...segments: string[]) => path.join(__dirname, 'fixtures', ...segments);
const readFixtureBuffer = (...segments: string[]): Buffer => fs.readFileSync(fixturePath(...segments));

describe('Commerzbank profile detection', () => {
  it('detects the Commerzbank minimal export', () => {
    const buffer = readFixtureBuffer('DE', 'commerzbank_min.csv');
    expect(isProfileCsvText(buffer, commerzbankProfile)).toBe(true);
  });

  it('does not mis-detect PayPal exports', () => {
    const buffer = readFixtureBuffer('paypal_min.csv');
    expect(isProfileCsvText(buffer, commerzbankProfile)).toBe(false);
  });
});

describe('parseWithProfile (Commerzbank)', () => {
  const buffer = readFixtureBuffer('DE', 'commerzbank_min.csv');
  const result = parseWithProfile(buffer, commerzbankProfile);

  it('defaults missing currency values to EUR', () => {
    expect(result.rows.length).toBeGreaterThan(0);
    result.rows.forEach(row => {
      expect(row.currency).toBe('EUR');
    });
  });

  it('derives account identifiers with the commerzbank: prefix', () => {
    expect(result.rows.every(row => row.accountId.startsWith('commerzbank:'))).toBe(true);
  });

  it('provides balance-derived metadata when saldo is present', () => {
    expect(result.openingBalance).toBeCloseTo(8500);
    expect(result.closingBalance).toBeCloseTo(7571.6, 3);
  });
});


