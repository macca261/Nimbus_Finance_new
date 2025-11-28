import { describe, it, expect } from 'vitest';
import { ingestFile } from '../ingestFile';

describe('ingestFile', () => {
  it('detects semicolon + latin1 with umlauts', async () => {
    const csv = Buffer.from('Konto;Betrag;Verwendungszweck\r\n123;100,50;Überweisung Müller\r\n', 'latin1');
    const result = await ingestFile(csv);

    expect(result.encoding).toBe('latin1');
    expect(result.delimiter).toBe(';');
    expect(result.header).toEqual(['Konto', 'Betrag', 'Verwendungszweck']);
    expect(result.rows).toEqual([['123', '100,50', 'Überweisung Müller']]);
  });

  it('detects comma + utf8', async () => {
    const csv = Buffer.from('date,amount,purpose\n2023-01-01,42.10,Coffee\n');
    const result = await ingestFile(csv, 'test_utf8.csv');

    expect(result.encoding).toBe('utf8');
    expect(result.delimiter).toBe(',');
    expect(result.header).toEqual(['date', 'amount', 'purpose']);
    expect(result.rows).toEqual([['2023-01-01', '42.10', 'Coffee']]);
  });
});


