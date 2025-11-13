import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ParseResult } from '../src/parsing/types';
import { parseBankCsv } from '../src/parser/parseBankCsv';
import { detect as detectPostbank, parse as parsePostbank } from '../src/parsing/profiles/postbank_de';

const fx = (...segments: string[]) => path.join(__dirname, 'fixtures', ...segments);

describe('Postbank CSV detection', () => {
  it('detects postbank header', () => {
    const text = fs.readFileSync(fx('postbank_min.csv'), 'utf8');
    const detection = detectPostbank(text);
    expect(detection.hit).toBe(true);
    expect(detection.confidence).toBe(1);
  });
});

describe('postbank parse', () => {
  it('parses rows into ParsedRow contracts', () => {
    const buffer = fs.readFileSync(fx('postbank_min.csv'));
    const result = parsePostbank(buffer);

    expect(result.profileId).toBe('postbank_de');
    expect(result.confidence).toBe(1);
    expect(result.rows.length).toBeGreaterThanOrEqual(2);

    const outgoing = result.rows.find(row => row.direction === 'out');
    expect(outgoing?.bookingDate).toBe('2025-08-05');
    expect(outgoing?.valutaDate).toBe('2025-08-05');
    expect(outgoing?.amountCents).toBe(-1234);
    expect(outgoing?.currency).toBe('EUR');
    expect(outgoing?.accountId).toBe('postbank:giro');
    expect(outgoing?.counterparty).toBeNull();
    expect((outgoing?.rawText ?? '').toLowerCase()).toContain('kartenzahlung');

    const incoming = result.rows.find(row => row.direction === 'in');
    expect(incoming?.bookingDate).toBe('2025-08-06');
    expect(incoming?.amountCents).toBe(245000);
    expect(incoming?.counterparty).toBe('ACME GmbH');
    expect(incoming?.accountIban).toBe('DE44500105175407324931');
  });

  it('is deterministic for identical input', () => {
    const buffer = fs.readFileSync(fx('postbank_min.csv'));
    const first = parsePostbank(buffer);
    const second = parsePostbank(buffer);
    expect(first).toEqual(second);
  });
});

describe('parseBankCsv integration (postbank)', () => {
  it('delegates to postbank profile when detection succeeds', async () => {
    const buffer = fs.readFileSync(fx('postbank_min.csv'));
    const direct: ParseResult = parsePostbank(buffer);
    const fromBank: ParseResult = await parseBankCsv(buffer);

    expect(fromBank.profileId).toBe('postbank_de');
    expect(fromBank.rows).toEqual(direct.rows);
    expect(fromBank.candidates).toEqual(direct.candidates);
    expect(fromBank.warnings).toEqual(direct.warnings);
    expect(fromBank.openingBalance).toBe(direct.openingBalance);
    expect(fromBank.closingBalance).toBe(direct.closingBalance);
  });
});


