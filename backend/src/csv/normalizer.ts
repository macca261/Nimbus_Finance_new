import { parse } from 'csv-parse/sync';
import { CSVDialectDetector } from './dialect';
import { BankAdapter, ADAPTERS } from './adapters';
import { parseGermanDate, parseGermanNumber } from './parser';

export type CanonicalTransaction = {
  booking_date: string;
  value_date?: string;
  amount: number;
  currency?: string;
  purpose?: string;
  counterpart_name?: string;
};

export function detectAdapter(headers: string[]): BankAdapter | null {
  for (const a of ADAPTERS) {
    const ok = a.headerPatterns.every(p => headers.some(h => p.test(h)));
    if (ok) return a;
  }
  return null;
}

export function normalizeCsvToCanonical(csvText: string): { adapter: BankAdapter | null; rows: CanonicalTransaction[] } {
  const detector = new CSVDialectDetector();
  const delimiter = detector.detectDelimiter(csvText);
  const records: any[] = parse(csvText, { columns: true, skip_empty_lines: true, delimiter, bom: true, trim: true, relax_column_count: true, relax_quotes: true });
  if (!records.length) return { adapter: null, rows: [] };
  const headers = Object.keys(records[0]);
  const adapter = detectAdapter(headers);

  if (!adapter) {
    // Generic mapping fallback
    const rows = records.map((r) => {
      const date = r['Buchungstag'] || r['Date'] || r['Buchung'] || r['Wertstellung'] || r['Wertstellung (Valuta)'];
      const amountRaw = r['Umsatz in EUR'] || r['Umsatz (EUR)'] || r['Betrag'] || r['Amount (EUR)'] || r['Amount'];
      const purpose = r['Buchungstext'] || r['Verwendungszweck'] || r['Reference'] || r['Payee'];
      return {
        booking_date: parseGermanDate(date),
        amount: parseGermanNumber(amountRaw),
        purpose,
      } as CanonicalTransaction;
    });
    return { adapter: null, rows };
  }

  const mapField = (row: any, key: string | string[] | undefined) => {
    if (!key) return undefined;
    const keys = Array.isArray(key) ? key : [key];
    for (const k of keys) {
      if (row[k] != null) return row[k];
    }
    return undefined;
  };

  const rows: CanonicalTransaction[] = [];
  for (const r of records) {
    try {
      const booking = mapField(r, adapter.mapping.bookingDate);
      const value = mapField(r, adapter.mapping.valueDate);
      const amountRaw = mapField(r, adapter.mapping.amount);
      const purpose = mapField(r, adapter.mapping.purpose);
      const counterpart = mapField(r, adapter.mapping.counterpartName);
      if (!booking || !amountRaw) continue;
      const amt = parseGermanNumber(String(amountRaw));
      if (Number.isNaN(amt)) continue;
      rows.push({
        booking_date: parseGermanDate(String(booking)),
        value_date: value ? parseGermanDate(String(value)) : undefined,
        amount: amt,
        currency: 'EUR',
        purpose: String(purpose || ''),
        counterpart_name: counterpart ? String(counterpart) : undefined,
      });
    } catch {
      // skip bad rows
    }
  }

  return { adapter, rows };
}


