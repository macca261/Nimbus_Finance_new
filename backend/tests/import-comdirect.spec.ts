import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import type { ParseResult } from '../src/parsing/types';
import { parseBankCsv } from '../src/parser/parseBankCsv';
import * as comdirect from '../src/parsing/profiles/comdirect_de';

const fx = (...p: string[]) => path.join(__dirname, 'fixtures', ...p);

describe('comdirect CSV detection', () => {
  it('detects comdirect header with metadata rows', () => {
    const text = fs.readFileSync(fx('comdirect_example.csv'), 'utf8');
    const d = comdirect.detect(text);
    expect(d.hit).toBe(true);
    expect(d.confidence).toBe(1);
  });
});

describe('comdirect parse', () => {
  it('parses rows into ParsedRow contracts', () => {
    const buffer = fs.readFileSync(fx('comdirect_example.csv'));
    const res = comdirect.parse(buffer);
    expect(res.profileId).toBe('comdirect_de');
    expect(res.confidence).toBe(1);
    expect(res.rows.length).toBe(3);

    // Check first transaction (outgoing)
    const out1 = res.rows.find(r => r.amountCents === -6699);
    expect(out1?.bookingDate).toBe('2025-10-27');
    expect(out1?.valutaDate).toBe('2025-10-27');
    expect(out1?.amountCents).toBe(-6699);
    expect(out1?.currency).toBe('EUR');
    expect(out1?.accountId).toBe('comdirect:giro');
    expect(out1?.direction).toBe('out');
    expect((out1?.rawText ?? '').toLowerCase()).toContain('miete');

    // Check second transaction (outgoing)
    const out2 = res.rows.find(r => r.amountCents === -1234);
    expect(out2?.bookingDate).toBe('2025-10-27');
    expect(out2?.amountCents).toBe(-1234);
    expect((out2?.rawText ?? '').toLowerCase()).toContain('rewe');

    // Check third transaction (incoming)
    const income = res.rows.find(r => r.amountCents === 300000);
    expect(income?.bookingDate).toBe('2025-03-01');
    expect(income?.amountCents).toBe(300000);
    expect(income?.direction).toBe('in');
    expect((income?.rawText ?? '').toLowerCase()).toContain('gehalt');
  });

  it('is deterministic for identical input', () => {
    const buffer = fs.readFileSync(fx('comdirect_example.csv'));
    const a = comdirect.parse(buffer);
    const b = comdirect.parse(buffer);
    expect(a).toEqual(b);
  });
});

describe('parseBankCsv integration (comdirect)', () => {
  it('delegates to comdirect_de when detection succeeds', async () => {
    const buffer = fs.readFileSync(fx('comdirect_example.csv'));
    const fromBank: ParseResult = await parseBankCsv(buffer);
    const direct: ParseResult = comdirect.parse(buffer);
    expect(fromBank.profileId).toBe('comdirect_de');
    expect(fromBank.rows).toEqual(direct.rows);
    expect(fromBank.candidates).toEqual(direct.candidates);
    expect(fromBank.warnings).toEqual(direct.warnings);
    expect(fromBank.openingBalance).toBe(direct.openingBalance);
    expect(fromBank.closingBalance).toBe(direct.closingBalance);
  });
});
