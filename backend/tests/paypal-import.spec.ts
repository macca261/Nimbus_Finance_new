import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { isPayPalCsvText, parsePayPalCsv, PayPalParseError } from '../src/parser/paypal';
import { parseBankCsv } from '../src/parser/parseBankCsv';
import type { ParseResult } from '../src/parsing/types';

const fixturePath = (...segments: string[]) => path.join(__dirname, 'fixtures', ...segments);

const readFixtureText = (name: string): string => fs.readFileSync(fixturePath(name), 'utf8');
const readFixtureBuffer = (name: string): Buffer => fs.readFileSync(fixturePath(name));

describe('PayPal CSV detection', () => {
  it('detects the official German PayPal export', () => {
    const text = readFixtureText('paypal_min.csv');
    expect(isPayPalCsvText(text)).toBe(true);
  });

  it('does not match non-PayPal CSV exports', () => {
    const otherCsv = readFixtureText('comdirect_min.csv');
    expect(isPayPalCsvText(otherCsv)).toBe(false);
  });
});

describe('parsePayPalCsv', () => {
  const paypalBuffer = readFixtureBuffer('paypal_min.csv');

  const expectDeterministic = (first: ParseResult, second: ParseResult) => {
    expect(first.profileId).toBe(second.profileId);
    expect(first.confidence).toBe(second.confidence);
    expect(first.warnings).toEqual(second.warnings);
    expect(first.candidates).toEqual(second.candidates);
    expect(first.openingBalance).toBe(second.openingBalance);
    expect(first.closingBalance).toBe(second.closingBalance);
    expect(first.rows).toEqual(second.rows);
  };

  it('parses PayPal CSV into ParsedRow contracts', () => {
    const result = parsePayPalCsv(paypalBuffer);

    expect(result.profileId).toBe('paypal');
    expect(result.confidence).toBe(1);
    expect(result.candidates).toEqual([{ profileId: 'paypal', confidence: 1 }]);
    expect(Array.isArray(result.rows)).toBe(true);
    expect(result.rows.length).toBeGreaterThan(0);

    const charge = result.rows.find(row => row.raw.externalId === '8E396761L8838473J');
    expect(charge).toBeDefined();

    if (!charge) {
      throw new Error('expected PayPal charge row');
    }

    expect(charge.bookingDate).toBe('2025-08-01');
    expect(charge.valutaDate).toBe('2025-08-01');
    expect(charge.amountCents).toBe(-499);
    expect(charge.currency).toBe('EUR');
    expect(charge.direction).toBe('out');
    expect(charge.accountId).toBe('paypal:wallet');
    expect(charge.accountIban).toBeNull();
    expect(charge.counterparty).toBe('Uber BV');
    expect(charge.counterpartyIban).toBeNull();
    expect(charge.mcc).toBeNull();
    expect(charge.reference).toBe('2FG39469NH0625446');
    expect(charge.rawText).toContain('Zahlung im Einzugsverfahren');
    expect(charge.raw.__source).toBe('csv_paypal');
    expect(charge.raw.categoryHint).toBe('mobilität.taxi_ridehail');

    expect(result.warnings).toEqual([]);
    expect(typeof result.openingBalance).toBe('number');
    expect(typeof result.closingBalance).toBe('number');
  });

  it('skips pending, memo or zero-amount rows', () => {
    const result = parsePayPalCsv(paypalBuffer);
    const rawStatuses = result.rows.map(row => String(row.raw.rawStatus).toLowerCase());
    expect(rawStatuses.every(status => status === 'abgeschlossen')).toBe(true);
    expect(result.rows.every(row => Math.abs(row.amountCents) > 0)).toBe(true);
  });

  it('is deterministic for identical input', () => {
    const first = parsePayPalCsv(paypalBuffer);
    const second = parsePayPalCsv(paypalBuffer);
    expectDeterministic(first, second);
  });

  it('parses the real PayPal CSV fixture without errors', () => {
    const buffer = readFixtureBuffer('paypal_real.csv');
    const result = parsePayPalCsv(buffer);

    expect(result.profileId).toBe('paypal');
    expect(result.confidence).toBe(1);
    expect(result.rows.length).toBeGreaterThan(0);

    const anyCompleted = result.rows.find(
      r =>
        String(r.raw.rawStatus || '').toLowerCase().includes('abgeschlossen') &&
        r.amountCents !== 0 &&
        r.raw.externalId,
    );

    expect(anyCompleted).toBeDefined();
  });

  it('throws PayPalParseError when no valid rows remain', () => {
    const text = readFixtureText('paypal_min.csv').replace(/Abgeschlossen/g, 'Ausstehend');
    const buffer = Buffer.from(text, 'utf8');
    expect(() => parsePayPalCsv(buffer)).toThrow(PayPalParseError);
  });
});

describe('parseBankCsv integration', () => {
  const paypalBuffer = readFixtureBuffer('paypal_min.csv');

  it('delegates to PayPal parser when detection succeeds', async () => {
    const resultFromBank = await parseBankCsv(paypalBuffer);
    const direct = parsePayPalCsv(paypalBuffer);
    expect(resultFromBank.profileId).toBe('paypal');
    expect(resultFromBank.rows).toEqual(direct.rows);
    expect(resultFromBank.candidates).toEqual(direct.candidates);
    expect(resultFromBank.warnings).toEqual(direct.warnings);
    expect(resultFromBank.openingBalance).toBe(direct.openingBalance);
    expect(resultFromBank.closingBalance).toBe(direct.closingBalance);
  });
});
