import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ParseResult } from '../src/parsing/types';
import { parseBankCsv } from '../src/parser/parseBankCsv';
import { detect as detectSparkasseDe, parse as parseSparkasseDe } from '../src/parsing/profiles/sparkasse_de';

const fixturePath = (...segments: string[]) => path.join(__dirname, 'fixtures', ...segments);
const readFixtureBuffer = (name: string): Buffer => fs.readFileSync(fixturePath(name));
const readFixtureText = (name: string): string => fs.readFileSync(fixturePath(name), 'utf8');

describe('Sparkasse CSV detection', () => {
  it('detects sparkasse header', () => {
    const text = readFixtureText('sparkasse_min.csv');
    const detection = detectSparkasseDe(text);
    expect(detection.hit).toBe(true);
    expect(detection.confidence).toBe(1);
  });
});

describe('sparkasse_de parse', () => {
  it('parses rows into ParsedRow contracts', () => {
    const buffer = readFixtureBuffer('sparkasse_min.csv');
    const res = parseSparkasseDe(buffer);

    expect(res.profileId).toBe('sparkasse_de');
    expect(res.confidence).toBe(1);
    expect(res.rows.length).toBeGreaterThanOrEqual(2);

    const outgoing = res.rows.find(row => row.direction === 'out');
    expect(outgoing?.bookingDate).toBe('2025-08-01');
    expect(outgoing?.valutaDate).toBe('2025-08-01');
    expect(outgoing?.amountCents).toBe(-2345);
    expect(outgoing?.currency).toBe('EUR');
    expect(outgoing?.accountId).toBe('sparkasse:giro');
    expect(outgoing?.counterparty).toBeNull();
    expect(outgoing?.rawText.toLowerCase()).toContain('kartenzahlung');

    const incoming = res.rows.find(row => row.direction === 'in');
    expect(incoming?.bookingDate).toBe('2025-08-02');
    expect(incoming?.amountCents).toBe(250000);
    expect(incoming?.counterparty).toBe('MUSTER GMBH');
    expect(incoming?.accountIban).toBe('DE02120300000000202051');

    const repeat = parseSparkasseDe(buffer);
    expect(repeat).toEqual(res);
  });
});

describe('parseBankCsv integration (sparkasse)', () => {
  it('delegates to sparkasse profile when detection succeeds', async () => {
    const buffer = readFixtureBuffer('sparkasse_min.csv');
    const direct: ParseResult = parseSparkasseDe(buffer);
    const fromBank: ParseResult = await parseBankCsv(buffer);

    expect(fromBank.profileId).toBe('sparkasse_de');
    expect(fromBank.rows).toEqual(direct.rows);
    expect(fromBank.candidates).toEqual(direct.candidates);
    expect(fromBank.warnings).toEqual(direct.warnings);
    expect(fromBank.openingBalance).toBe(direct.openingBalance);
    expect(fromBank.closingBalance).toBe(direct.closingBalance);
  });
});


