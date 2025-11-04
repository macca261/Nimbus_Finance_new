import { describe, it, expect } from 'vitest';
import { parseTransactions } from '../dist/index.js';

describe('parsers-de smoke', () => {
  it('parses basic ; + comma-decimal CSV and normalizes', () => {
    const csv = Buffer.from(
      ['Buchungsdatum;Wertstellung;Betrag;Verwendungszweck', '01.10.2025;01.10.2025;1.234,56;Test'].join('\n'),
      'utf8'
    );
    const out = parseTransactions(csv, 'ing');
    expect(out[0].amount).toBe('1234.56');
    expect(out[0].bookingDate).toBe('2025-10-01');
    expect(out[0].currency).toBe('EUR');
  });
});

