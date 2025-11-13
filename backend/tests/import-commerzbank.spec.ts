import fs from 'node:fs';
import path from 'node:path';

import { describe, it, expect } from 'vitest';

import type { ParseResult } from '../src/parsing/types';
import { parseBankCsv } from '../src/parser/parseBankCsv';
import { detect as detectCommerzbank, parse as parseCommerzbank } from '../src/parsing/profiles/commerzbank_de';

const fx = (...segments: string[]) => path.join(__dirname, 'fixtures', ...segments);

describe('Commerzbank CSV detection', () => {
  it('detects commerzbank header', () => {
    const text = fs.readFileSync(fx('commerzbank_min.csv'), 'utf8');
    const detection = detectCommerzbank(text);
    expect(detection.hit).toBe(true);
    expect(detection.confidence).toBe(1);
  });
});

describe('commerzbank parse', () => {
  it('parses rows into ParsedRow contracts', () => {
    const buffer = fs.readFileSync(fx('commerzbank_min.csv'));
    const result = parseCommerzbank(buffer);

    expect(result.profileId).toBe('commerzbank_de');
    expect(result.confidence).toBe(1);
    expect(result.rows.length).toBeGreaterThanOrEqual(2);

    const outgoing = result.rows.find(row => row.direction === 'out');
    expect(outgoing?.bookingDate).toBe('2025-08-03');
    expect(outgoing?.valutaDate).toBe('2025-08-03');
    expect(outgoing?.amountCents).toBe(-3245);
    expect(outgoing?.currency).toBe('EUR');
    expect(outgoing?.accountId).toBe('commerzbank:giro');
    expect(outgoing?.counterparty).toBeNull();
    expect((outgoing?.rawText ?? '').toLowerCase()).toContain('kartenzahlung');

    const incoming = result.rows.find(row => row.direction === 'in');
    expect(incoming?.bookingDate).toBe('2025-08-04');
    expect(incoming?.amountCents).toBe(285000);
    expect(incoming?.counterparty).toBe('ACME GmbH');
    expect(incoming?.accountIban).toBe('DE02100400000512345678');
  });

  it('is deterministic for identical input', () => {
    const buffer = fs.readFileSync(fx('commerzbank_min.csv'));
    const first = parseCommerzbank(buffer);
    const second = parseCommerzbank(buffer);
    expect(first).toEqual(second);
  });
});

describe('parseBankCsv integration (commerzbank)', () => {
  it('delegates to commerzbank_de when detection succeeds', async () => {
    const buffer = fs.readFileSync(fx('commerzbank_min.csv'));
    const direct: ParseResult = parseCommerzbank(buffer);
    const fromBank: ParseResult = await parseBankCsv(buffer);

    expect(fromBank.profileId).toBe('commerzbank_de');
    expect(fromBank.rows).toEqual(direct.rows);
    expect(fromBank.candidates).toEqual(direct.candidates);
    expect(fromBank.warnings).toEqual(direct.warnings);
    expect(fromBank.openingBalance).toBe(direct.openingBalance);
    expect(fromBank.closingBalance).toBe(direct.closingBalance);
  });
});


