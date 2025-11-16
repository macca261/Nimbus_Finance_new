import { describe, it, expect } from 'vitest';

import { readFileSync } from 'fs';

import { resolve } from 'path';

import { parseBankCsv } from '../src/parser/parseBankCsv';

describe('Deutsche Bank CSV parser', () => {

  const fixturePath = resolve(__dirname, 'fixtures', 'deutsche_bank_min.csv');

  const buffer = readFileSync(fixturePath);

  it('detects Deutsche Bank and parses rows', () => {

    const result = parseBankCsv(buffer);

    expect(result.profileId).toBe('deutsche_bank');

    expect(result.rows.length).toBeGreaterThan(0);

    for (const row of result.rows) {

      expect(row.bookingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      expect(typeof row.amountCents).toBe('number');

      expect(['in', 'out']).toContain(row.direction);

      expect(row.externalId).toMatch(/^deutsche_bank-/);

    }

  });

  it('is deterministic for the same CSV buffer', () => {

    const r1 = parseBankCsv(buffer);

    const r2 = parseBankCsv(buffer);

    expect(r1.rows).toEqual(r2.rows);

  });

});

