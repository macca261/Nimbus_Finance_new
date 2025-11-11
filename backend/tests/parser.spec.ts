import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseBankCsv, ParseBankCsvError } from '../src/parser/parseBankCsv';

const fixture = (name: string): Buffer =>
  fs.readFileSync(path.join(__dirname, 'fixtures', name));

describe('parseBankCsv', () => {
  it('parses a real comdirect export with preamble', async () => {
    const result = await parseBankCsv(fixture('comdirect_preamble.csv'));
    expect(result.profileId).toBe('comdirect');
    expect(result.rows.length).toBeGreaterThan(0);
    const first = result.rows[0];
    expect(first.bookingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(first.currency).toBe('EUR');
    expect(typeof first.amountCents).toBe('number');
  });

  it('parses a simple Sparkasse sample', async () => {
    const csv = [
      'Buchungstag;Wertstellung;Buchungstext;Auftraggeber/Begünstigter;Verwendungszweck;Betrag;Währung',
      '05.03.2024;05.03.2024;GUTSCHRIFT;MUSTERMANN GMBH;GEHALT;2.500,00;EUR',
      '06.03.2024;06.03.2024;LASTSCHRIFT;EDEKA;EINKAUF;-129,45;EUR',
    ].join('\n');
    const result = await parseBankCsv(Buffer.from(csv, 'utf8'));
    expect(result.profileId).toBe('sparkasse');
    expect(result.rows.length).toBe(2);
    const income = result.rows.find(tx => tx.amountCents > 0);
    expect(income?.amountCents).toBe(250000);
    const expense = result.rows.find(tx => tx.amountCents < 0);
    expect(expense?.amountCents).toBe(-12945);
  });

  it('provides detailed feedback for unsupported headers', async () => {
    const csv = [
      'Date,Details,Amount',
      '2024-01-01,Test,123.45',
    ].join('\n');
    await expect(parseBankCsv(Buffer.from(csv, 'utf8'))).rejects.toMatchObject({
      hints: expect.any(Array),
      candidates: expect.any(Array),
    });
  });

  it('ignores summary rows like "Alter Kontostand"', async () => {
    const csv = [
      'Umsätze Girokonto;Zeitraum: 01.03.2025 - 31.03.2025;;;;',
      'Neuer Kontostand;1.234,56 EUR;;;;',
      'Alter Kontostand;1.000,00 EUR;;;;',
      'Buchungstag;Wertstellung (Valuta);Vorgang;Buchungstext;Umsatz in EUR',
      'Alter Kontostand;;;;;',
      '03.03.2025;03.03.2025;Kartenzahlung;REWE;-9,99',
    ].join('\n');
    const result = await parseBankCsv(Buffer.from(csv, 'utf8'));
    expect(result.profileId).toBe('comdirect');
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].amountCents).toBe(-999);
    expect(result.warnings ?? []).toHaveLength(0);
  });

  it('extracts balances from real comdirect export', async () => {
    const result = await parseBankCsv(fixture('Comdirect_real.csv'));
    expect(result.profileId).toBe('comdirect');
    expect(result.rows.length).toBeGreaterThan(0);
    expect(typeof result.openingBalance).toBe('number');
    expect(typeof result.closingBalance).toBe('number');
    expect(Number.isNaN(result.openingBalance ?? NaN)).toBe(false);
    expect(Number.isNaN(result.closingBalance ?? NaN)).toBe(false);
    const warnings = result.warnings ?? [];
    expect(warnings.some(warning => /alter kontostand/i.test(warning))).toBe(false);
  });
});

