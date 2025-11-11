import { describe, it, expect } from 'vitest';
import { parseBankCsv } from '../src/parsers/parseBankCsv';
import fs from 'node:fs';
import path from 'node:path';

const fx = (name: string) => fs.readFileSync(path.join(__dirname, 'fixtures', name));

describe('bank CSV parser', () => {
  it('parses comdirect with preamble + semicolon + decimal comma', () => {
    const buf = fx('comdirect_min.csv');
    const out = parseBankCsv(buf);
    expect(out.profileId).toBe('comdirect');
    expect(out.transactions.length).toBeGreaterThan(0);
    const t0 = out.transactions[0];
    expect(t0.bookedAt).toBe('2025-10-01');
    expect(t0.amount).toBeLessThan(0);
    expect(t0.currency).toBe('EUR');
  });

  it('throws helpful error for unknown', () => {
    const bad = Buffer.from('foo,bar\n1,2\n');
    try {
      parseBankCsv(bad);
      throw new Error('expected fail');
    } catch (e: any) {
      expect(String(e.message)).toMatch(/Unsupported or undetected bank/);
      expect(e.tried).toBeDefined();
    }
  });
});

