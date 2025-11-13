import fs from 'node:fs';
import path from 'node:path';

import { describe, it, expect } from 'vitest';

import { parseBankCsv } from '../src/parser/parseBankCsv';
import { isProfileCsvText } from '../src/parsing/profileEngine';
import { ingProfile } from '../src/parsing/profiles/ing';

const fx = (...p: string[]) => path.join(__dirname, 'fixtures', 'DE', ...p);
const readBuf = (n: string) => fs.readFileSync(fx(n));

describe('ING CSV detection + parse', () => {
  it('detects ING header', () => {
    const buf = readBuf('ing_min.csv');
    expect(isProfileCsvText(buf, ingProfile)).toBe(true);
  });

  it('parses rows and shapes ParsedRow contract', async () => {
    const buf = readBuf('ing_min.csv');
    const result = await parseBankCsv(buf);
    expect(result.profileId).toBe('ing');
    expect(result.confidence).toBe(1);
    expect(result.rows.length).toBeGreaterThan(0);
    const first = result.rows[0];
    expect(first.bookingDate).toBe('2025-11-16');
    expect(typeof first.amountCents).toBe('number');
    expect(first.currency).toBe('EUR');
    expect(['in', 'out']).toContain(first.direction);
    expect(first.accountId.startsWith('ing:')).toBe(true);
  });
});

