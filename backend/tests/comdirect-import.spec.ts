import { describe, it, expect } from 'vitest';

import { readFileSync } from 'fs';

import { resolve } from 'path';

import { parseBankCsv } from '../src/parser/parseBankCsv';

describe('comdirect CSV parser', () => {

  const minPath = resolve(__dirname, 'fixtures', 'comdirect_min.csv');

  const latin1Path = resolve(__dirname, 'fixtures', 'latin1_comdirect.csv');

  const minBuffer = readFileSync(minPath);

  const latin1Buffer = readFileSync(latin1Path);

  it('detects comdirect and parses rows from comdirect_min.csv', () => {

    const result = parseBankCsv(minBuffer);

    expect(result.profileId).toBe('comdirect');

    expect(result.rows.length).toBeGreaterThan(0);

    for (const row of result.rows) {

      expect(row.bookingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      expect(typeof row.amountCents).toBe('number');

      expect(['in', 'out']).toContain(row.direction);

      expect(row.externalId).toMatch(/^comdirect-/);

    }

  });

  it('parses Latin-1 encoded comdirect CSV deterministically', () => {

    const r1 = parseBankCsv(latin1Buffer);

    const r2 = parseBankCsv(latin1Buffer);

    expect(r1.profileId).toBe('comdirect');

    expect(r1.rows.length).toBeGreaterThan(0);

    expect(r1.rows).toEqual(r2.rows);

  });

});

