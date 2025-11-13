import fs from 'node:fs';
import path from 'node:path';

import { describe, it, expect } from 'vitest';

import type { ParseResult } from '../src/parsing/types';
import { parseBankCsv } from '../src/parser/parseBankCsv';
import { detect as detectDeutscheBank, parse as parseDeutscheBank } from '../src/parsing/profiles/deutsche_bank_de';

const fx = (...segments: string[]) => path.join(__dirname, 'fixtures', ...segments);

describe('Deutsche Bank CSV detection', () => {
  it('detects deutsche bank header', () => {
    const text = fs.readFileSync(fx('deutsche_bank_min.csv'), 'utf8');
    const detection = detectDeutscheBank(text);
    expect(detection.hit).toBe(true);
    expect(detection.confidence).toBe(1);
  });
});

describe('deutsche bank parse', () => {
  it('parses rows into ParsedRow contracts', () => {
    const buffer = fs.readFileSync(fx('deutsche_bank_min.csv'));
    const result = parseDeutscheBank(buffer);

    expect(result.profileId).toBe('deutsche_bank_de');
    expect(result.confidence).toBe(1);
    expect(result.rows.length).toBeGreaterThanOrEqual(2);

    const outgoing = result.rows.find(row => row.direction === 'out');
    expect(outgoing?.bookingDate).toBe('2025-08-01');
    expect(outgoing?.valutaDate).toBe('2025-08-01');
    expect(outgoing?.amountCents).toBe(-1990);
    expect(outgoing?.currency).toBe('EUR');
    expect(outgoing?.accountId).toBe('deutschebank:giro');
    expect(outgoing?.counterparty).toBeNull();
    expect(outgoing?.rawText.toLowerCase()).toContain('kartenzahlung');

    const incoming = result.rows.find(row => row.direction === 'in');
    expect(incoming?.bookingDate).toBe('2025-08-02');
    expect(incoming?.amountCents).toBe(320000);
    expect(incoming?.counterparty).toBe('ACME GmbH');
    expect(incoming?.accountIban).toBe('DE44500105175407324931');
  });

  it('is deterministic for identical input', () => {
    const buffer = fs.readFileSync(fx('deutsche_bank_min.csv'));
    const first = parseDeutscheBank(buffer);
    const second = parseDeutscheBank(buffer);
    expect(first).toEqual(second);
  });
});

describe('parseBankCsv integration (deutsche bank)', () => {
  it('delegates to deutsche bank profile when detection succeeds', async () => {
    const buffer = fs.readFileSync(fx('deutsche_bank_min.csv'));
    const direct: ParseResult = parseDeutscheBank(buffer);
    const fromBank: ParseResult = await parseBankCsv(buffer);

    expect(fromBank.profileId).toBe('deutsche_bank_de');
    expect(fromBank.rows).toEqual(direct.rows);
    expect(fromBank.candidates).toEqual(direct.candidates);
    expect(fromBank.warnings).toEqual(direct.warnings);
    expect(fromBank.openingBalance).toBe(direct.openingBalance);
    expect(fromBank.closingBalance).toBe(direct.closingBalance);
  });
});


