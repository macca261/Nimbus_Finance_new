import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ParseResult } from '../src/parsing/types';
import { parseBankCsv } from '../src/parser/parseBankCsv';
import { detect as detectIng, parse as parseIng } from '../src/parsing/profiles/ing_de';

const fx = (...segments: string[]) => path.join(__dirname, 'fixtures', ...segments);

describe('ING CSV detection', () => {
  it('detects ING header', () => {
    const text = fs.readFileSync(fx('ing_min.csv'), 'utf8');
    const detection = detectIng(text);
    expect(detection.hit).toBe(true);
    expect(detection.confidence).toBe(1);
  });
});

describe('ING CSV parse', () => {
  it('parses into ParsedRow contracts', () => {
    const buffer = fs.readFileSync(fx('ing_min.csv'));
    const result = parseIng(buffer);

    expect(result.profileId).toBe('ing_de');
    expect(result.confidence).toBe(1);
    expect(result.rows.length).toBe(2);

    const card = result.rows.find(row => row.direction === 'out');
    expect(card?.bookingDate).toBe('2025-08-04');
    expect(card?.valutaDate).toBe('2025-08-04');
    expect(card?.amountCents).toBe(-1234);
    expect(card?.currency).toBe('EUR');
    expect(card?.accountId).toBe('ing:giro');
    expect((card?.rawText ?? '').toLowerCase()).toContain('kartenzahlung');

    const income = result.rows.find(row => row.direction === 'in');
    expect(income?.bookingDate).toBe('2025-08-05');
    expect(income?.amountCents).toBe(250000);
    expect(income?.counterparty).toBe('ACME GmbH');
    expect(income?.accountId).toBe('ing:giro');
  });

  it('is deterministic', () => {
    const buffer = fs.readFileSync(fx('ing_min.csv'));
    const first = parseIng(buffer);
    const second = parseIng(buffer);
    expect(first).toEqual(second);
  });
});

describe('parseBankCsv integration (ING)', () => {
  it('delegates to ing_de when detection succeeds', async () => {
    const buffer = fs.readFileSync(fx('ing_min.csv'));
    const direct: ParseResult = parseIng(buffer);
    const fromBank: ParseResult = await parseBankCsv(buffer);

    expect(fromBank.profileId).toBe('ing_de');
    expect(fromBank.rows).toEqual(direct.rows);
    expect(fromBank.candidates).toEqual(direct.candidates);
    expect(fromBank.warnings).toEqual(direct.warnings);
    expect(fromBank.openingBalance).toBe(direct.openingBalance);
    expect(fromBank.closingBalance).toBe(direct.closingBalance);
  });
});

