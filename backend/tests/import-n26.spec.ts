import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ParseResult } from '../src/parsing/types';
import { parseBankCsv } from '../src/parser/parseBankCsv';
import { detect as detectN26, parse as parseN26 } from '../src/parsing/profiles/n26_de';

const fx = (...segments: string[]) => path.join(__dirname, 'fixtures', ...segments);

describe('N26 CSV detection', () => {
  it('detects N26 header', () => {
    const text = fs.readFileSync(fx('n26_min.csv'), 'utf8');
    const detection = detectN26(text);
    expect(detection.hit).toBe(true);
    expect(detection.confidence).toBe(1);
  });
});

describe('N26 CSV parse', () => {
  it('parses rows into ParsedRow contracts', () => {
    const buffer = fs.readFileSync(fx('n26_min.csv'));
    const result = parseN26(buffer);

    expect(result.profileId).toBe('n26_de');
    expect(result.confidence).toBe(1);
    expect(result.rows.length).toBe(2);

    const card = result.rows.find(row => row.direction === 'out');
    expect(card?.bookingDate).toBe('2025-08-04');
    expect(card?.valutaDate).toBe('2025-08-04');
    expect(card?.amountCents).toBe(-879);
    expect(card?.currency).toBe('EUR');
    expect((card?.rawText ?? '').toLowerCase()).toContain('card_payment');

    const income = result.rows.find(row => row.direction === 'in');
    expect(income?.bookingDate).toBe('2025-08-05');
    expect(income?.amountCents).toBe(250000);
    expect(income?.counterparty).toBe('ACME GmbH');
  });

  it('is deterministic for identical input', () => {
    const buffer = fs.readFileSync(fx('n26_min.csv'));
    const first = parseN26(buffer);
    const second = parseN26(buffer);
    expect(first).toEqual(second);
  });
});

describe('parseBankCsv integration (N26)', () => {
  it('delegates to n26 profile when detection succeeds', async () => {
    const buffer = fs.readFileSync(fx('n26_min.csv'));
    const direct: ParseResult = parseN26(buffer);
    const fromBank: ParseResult = await parseBankCsv(buffer);

    expect(fromBank.profileId).toBe('n26_de');
    expect(fromBank.rows).toEqual(direct.rows);
    expect(fromBank.candidates).toEqual(direct.candidates);
    expect(fromBank.warnings).toEqual(direct.warnings);
    expect(fromBank.openingBalance).toBe(direct.openingBalance);
    expect(fromBank.closingBalance).toBe(direct.closingBalance);
  });
});


