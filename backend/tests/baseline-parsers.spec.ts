import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parsePayPalCsv } from '../src/parsing/paypal';
import { parse as parseCommerzbankCsv } from '../src/parsing/profiles/commerzbank_de';

const fx = (...segments: string[]) => path.join(__dirname, 'fixtures', ...segments);

describe('baseline parsers', () => {
  it('parses paypal_min.csv and keeps merchant unset when no counterparty', () => {
    const buffer = fs.readFileSync(fx('paypal_min.csv'));
    const parsed = parsePayPalCsv(buffer);
    expect(parsed.rows.length).toBeGreaterThan(0);

    const anyMerchantField = parsed.rows.some(row => Object.prototype.hasOwnProperty.call(row, 'merchant'));
    expect(anyMerchantField).toBe(false);
  });

  it('parses commerzbank_min.csv with existing behaviour intact', () => {
    const buffer = fs.readFileSync(fx('commerzbank_min.csv'));
    const result = parseCommerzbankCsv(buffer);
    expect(result.rows.length).toBeGreaterThan(0);

    const anyMerchantField = result.rows.some(row => Object.prototype.hasOwnProperty.call(row, 'merchant'));
    expect(anyMerchantField).toBe(false);
  });
});


