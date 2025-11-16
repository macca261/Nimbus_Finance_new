import { describe, it, expect } from 'vitest';

import { readFileSync } from 'fs';

import { resolve } from 'path';

import { parseBankCsv } from '../src/parser/parseBankCsv';

describe('DKB CSV parser', () => {

  const minPath = resolve(__dirname, 'fixtures', 'dkb_min.csv');

  const fullPath = resolve(__dirname, 'fixtures', 'dkb.csv');

  const minBuffer = readFileSync(minPath);

  const fullBuffer = readFileSync(fullPath);

  it('detects DKB and parses rows from dkb_min.csv', () => {

    const result = parseBankCsv(minBuffer);

    expect(result.profileId).toBe('dkb');

    expect(result.rows.length).toBeGreaterThan(0);

    for (const row of result.rows) {

      expect(row.bookingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      expect(typeof row.amountCents).toBe('number');

      expect(['in', 'out']).toContain(row.direction);

      expect(row.externalId).toMatch(/^dkb-/);

    }

  });

  it('parses full dkb.csv deterministically', () => {

    const r1 = parseBankCsv(fullBuffer);

    const r2 = parseBankCsv(fullBuffer);

    expect(r1.profileId).toBe('dkb');

    expect(r1.rows.length).toBeGreaterThan(0);

    expect(r1.rows).toEqual(r2.rows);

  });

});
