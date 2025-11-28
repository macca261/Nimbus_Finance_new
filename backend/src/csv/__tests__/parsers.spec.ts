import { describe, it, expect } from 'vitest';
import { LegacyGermanParser } from '../parsers/legacyGermanParser';
import { NeobankParser } from '../parsers/neobankParser';
import { PayPalParser } from '../parsers/paypalParser';

describe('CSV bank parsers', () => {
  it('parses Sparkasse-style row', () => {
    const parser = new LegacyGermanParser();
    const ctx = {
      signature: { id: 'sparkasse.generic', family: 'GermanLegacy', numberFormat: 'commaDecimal' },
      header: ['Buchungstag', 'Valutadatum', 'Betrag', 'Währung', 'Buchungstext', 'Verwendungszweck', 'Begünstigter/Zahlungspflichtiger'],
      rows: [['01.01.2024', '02.01.2024', '1.234,56', 'EUR', 'Kartenzahlung', 'Rewe Markt', 'REWE Markt 123']],
    };
    const result = parser.parse(ctx as any);
    expect(result).toHaveLength(1);
    expect(result[0].bookingDate).toBe('2024-01-01');
    expect(result[0].amount).toBeCloseTo(1234.56);
    expect(result[0].purpose).toContain('Rewe');
  });

  it('parses N26 row', () => {
    const parser = new NeobankParser();
    const ctx = {
      signature: { id: 'n26.standard', family: 'Neobank' },
      header: ['date', 'payee', 'transaction type', 'payment reference', 'category', 'amount (eur)'],
      rows: [['2024-01-05', 'Coffee Fellows', 'Card Payment', 'Latte', 'Food & Drink', '-4.20']],
    };
    const result = parser.parse(ctx as any);
    expect(result).toHaveLength(1);
    expect(result[0].bookingDate).toBe('2024-01-05');
    expect(result[0].amount).toBeCloseTo(-4.2);
    expect(result[0].counterpartName).toBe('Coffee Fellows');
  });

  it('parses PayPal row', () => {
    const parser = new PayPalParser();
    const ctx = {
      signature: { id: 'paypal.de', family: 'PayPal' },
      header: ['date', 'status', 'gross', 'currency', 'name', 'type'],
      rows: [['2024-02-01', 'Completed', '15.00', 'EUR', 'Spotify', 'Subscription Payment']],
    };
    const result = parser.parse(ctx as any);
    expect(result).toHaveLength(1);
    expect(result[0].bookingDate).toBe('2024-02-01');
    expect(result[0].amount).toBeCloseTo(15);
    expect(result[0].counterpartName).toBe('Spotify');
  });
});


