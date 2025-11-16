import { describe, it, expect } from 'vitest';

import { readFileSync } from 'fs';

import { resolve } from 'path';

import { parseBankCsv } from '../src/parser/parseBankCsv';

function loadFixture(name: string): Buffer {

  return readFileSync(resolve(__dirname, 'fixtures', name));

}

describe('PayPal parser – additional real-world fixtures', () => {

  const fixtures = ['paypal_basic.csv', 'paypal_min.csv', 'paypal_real.csv'];

  for (const name of fixtures) {

    it(`parses ${name} via parseBankCsv`, () => {

      const buffer = loadFixture(name);

      const result = parseBankCsv(buffer);

      expect(result.profileId).toBe('paypal');

      expect(result.rows.length).toBeGreaterThan(0);

      for (const row of result.rows) {

        expect(row.bookingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        expect(typeof row.amountCents).toBe('number');

        expect(['in', 'out']).toContain(row.direction);

      }

    });

    it(`is deterministic for ${name}`, () => {

      const buffer = loadFixture(name);

      const r1 = parseBankCsv(buffer);

      const r2 = parseBankCsv(buffer);

      expect(r1.rows).toEqual(r2.rows);

    });

  }

});

