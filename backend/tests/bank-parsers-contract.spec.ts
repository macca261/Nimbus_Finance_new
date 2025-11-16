import { describe, it, expect } from 'vitest';

import { readFileSync, existsSync } from 'fs';

import { resolve } from 'path';

import { parseBankCsv } from '../src/parser/parseBankCsv';

// List of known fixtures and their expected profileIds.

// Adjust paths only if your fixtures live elsewhere.

const FIXTURES: { name: string; expectedProfileId: string }[] = [

  { name: 'comdirect_min.csv', expectedProfileId: 'comdirect' },

  { name: 'latin1_comdirect.csv', expectedProfileId: 'comdirect' },

  { name: 'commerzbank_min.csv', expectedProfileId: 'commerzbank' },

  { name: 'deutsche_bank_min.csv', expectedProfileId: 'deutsche_bank' },

  { name: 'dkb_min.csv', expectedProfileId: 'dkb' },

  { name: 'dkb.csv', expectedProfileId: 'dkb' },

  { name: 'ing_min.csv', expectedProfileId: 'ing' },

  { name: 'ing.csv', expectedProfileId: 'ing' },

  { name: 'n26_min.csv', expectedProfileId: 'n26' },

  { name: 'paypal_basic.csv', expectedProfileId: 'paypal' },

  { name: 'paypal_min.csv', expectedProfileId: 'paypal' },

  { name: 'paypal_real.csv', expectedProfileId: 'paypal' },

  // If sparkasse_min.csv exists, this will be picked up:

  { name: 'sparkasse_min.csv', expectedProfileId: 'sparkasse' },

];

function fixturePath(name: string): string {

  return resolve(__dirname, 'fixtures', name);

}

describe('Bank parsers – global contract', () => {

  for (const { name, expectedProfileId } of FIXTURES) {

    const path = fixturePath(name);

    // Only run tests for fixtures that actually exist in the repo

    if (!existsSync(path)) {

      // eslint-disable-next-line no-console

      console.warn(`[bank-parsers-contract] Fixture missing, skipping: ${name}`);

      continue;

    }

    const buffer = readFileSync(path);

    describe(`${expectedProfileId} – ${name}`, () => {

      it('parses via parseBankCsv and respects core invariants', () => {

        const result = parseBankCsv(buffer);

        expect(result.profileId).toBe(expectedProfileId);

        expect(result.rows.length).toBeGreaterThan(0);

        const seenExternalIds = new Set<string>();

        for (const row of result.rows) {

          // bookingDate must be ISO yyyy-MM-dd

          expect(row.bookingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

          // amountCents must be non-zero integer

          expect(typeof row.amountCents).toBe('number');

          expect(Number.isInteger(row.amountCents)).toBe(true);

          expect(row.amountCents).not.toBe(0);

          // direction must be consistent with sign of amountCents

          expect(['in', 'out']).toContain(row.direction);

          if (row.amountCents > 0) {

            expect(row.direction).toBe('in');

          } else if (row.amountCents < 0) {

            expect(row.direction).toBe('out');

          }

          // externalId must be non-empty and unique within the file

          expect(typeof row.externalId).toBe('string');

          expect(row.externalId.length).toBeGreaterThan(0);

          expect(seenExternalIds.has(row.externalId)).toBe(false);

          seenExternalIds.add(row.externalId);

          // rawText should be present for debugging, even if short

          expect(typeof row.rawText).toBe('string');

        }

      });

      it('is deterministic for the same CSV buffer', () => {

        const r1 = parseBankCsv(buffer);

        const r2 = parseBankCsv(buffer);

        expect(r1.rows).toEqual(r2.rows);

        expect(r1.profileId).toBe(r2.profileId);

      });

    });

  }

});

