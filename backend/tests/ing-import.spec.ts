import { describe, it, expect } from 'vitest';

import { readFileSync } from 'fs';

import { resolve } from 'path';

import { parseBankCsv } from '../src/parser/parseBankCsv';

describe('ING CSV parser', () => {

  const minPath = resolve(__dirname, 'fixtures', 'ing_min.csv');

  const fullPath = resolve(__dirname, 'fixtures', 'ing.csv');

  const minBuffer = readFileSync(minPath);

  const fullBuffer = readFileSync(fullPath);

  it('detects ING and parses rows from ing_min.csv', () => {

    const result = parseBankCsv(minBuffer);

    expect(result.profileId).toBe('ing');

    expect(result.rows.length).toBeGreaterThan(0);

    for (const row of result.rows) {

      expect(row.bookingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      expect(typeof row.amountCents).toBe('number');

      expect(['in', 'out']).toContain(row.direction);

      expect(row.externalId).toMatch(/^ing-/);

    }

  });

  it('parses full ing.csv deterministically', () => {

    const r1 = parseBankCsv(fullBuffer);

    const r2 = parseBankCsv(fullBuffer);

    expect(r1.profileId).toBe('ing');

    expect(r1.rows.length).toBeGreaterThan(0);

    expect(r1.rows).toEqual(r2.rows);

  });

});
