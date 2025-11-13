import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseBankCsv } from '../src/parser/parseBankCsv';
import { detect as detectDkbDe, parse as parseDkbDe } from '../src/parsing/profiles/dkb_de';

const fixturePath = (...segments: string[]) => path.join(__dirname, 'fixtures', ...segments);
const readFixtureText = (name: string): string => fs.readFileSync(fixturePath(name), 'utf8');
const readFixtureBuffer = (name: string): Buffer => fs.readFileSync(fixturePath(name));

describe('DKB Giro CSV profile (dkb_de)', () => {
  it('detects DKB header structure', () => {
    const text = readFixtureText('dkb_min.csv');
    const detection = detectDkbDe(text);
    expect(detection.hit).toBe(true);
    expect(detection.confidence).toBe(1);
  });

  it('parses rows into ParsedRow contracts', () => {
    const buffer = readFixtureBuffer('dkb_min.csv');
    const direct = parseDkbDe(buffer);

    expect(direct.profileId).toBe('dkb_de');
    expect(direct.confidence).toBe(1);
    expect(direct.rows.length).toBeGreaterThanOrEqual(2);

    const rewe = direct.rows.find(row => row.rawText.includes('Kartenzahlung'));
    expect(rewe).toBeDefined();
    if (!rewe) throw new Error('REWE row missing');
    expect(rewe.bookingDate).toBe('2025-08-01');
    expect(rewe.valutaDate).toBe('2025-08-01');
    expect(rewe.amountCents).toBe(-2345);
    expect(rewe.currency).toBe('EUR');
    expect(rewe.direction).toBe('out');
    expect(rewe.accountId).toBe('dkb:giro');
    expect(rewe.counterparty).toBeNull();
    expect(rewe.reference).toBeNull();

    const salary = direct.rows.find(row => row.counterparty === 'MUSTER GMBH');
    expect(salary).toBeDefined();
    if (!salary) throw new Error('Salary row missing');
    expect(salary.bookingDate).toBe('2025-08-02');
    expect(salary.valutaDate).toBe('2025-08-02');
    expect(salary.amountCents).toBe(250000);
    expect(salary.direction).toBe('in');
    expect(salary.accountId).toBe('dkb:giro');
    expect(salary.accountIban).toBe('DE02120300000000202051');

    const again = parseDkbDe(buffer);
    expect(again).toEqual(direct);
  });

  it('integrates with parseBankCsv', async () => {
    const buffer = readFixtureBuffer('dkb_min.csv');
    const direct = parseDkbDe(buffer);
    const result = await parseBankCsv(buffer);

    expect(result.profileId).toBe('dkb_de');
    expect(result.rows).toEqual(direct.rows);
    expect(result.candidates).toEqual(direct.candidates);
    expect(result.confidence).toBe(1);
  });
});


