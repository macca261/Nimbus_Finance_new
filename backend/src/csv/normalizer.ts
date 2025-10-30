import { parse } from 'csv-parse/sync';
import { CSVDialectDetector } from './dialect';
import { parseGermanDate, parseGermanNumber } from './parser';
import { loadAdapters, chooseAdapter, mapToCanonical } from '../ingest/adapter-engine';

export type CanonicalTransaction = {
  booking_date: string;
  value_date?: string;
  amount: number;
  currency?: string;
  purpose?: string;
  counterpart_name?: string;
};

export function normalizeCsvToCanonical(csvText: string): { adapter: { bankName?: string; id?: string } | null; rows: CanonicalTransaction[] } {
  const detector = new CSVDialectDetector();
  const delimiter = detector.detectDelimiter(csvText);
  const records: any[] = parse(csvText, { columns: true, skip_empty_lines: true, delimiter, bom: true, trim: true, relax_column_count: true, relax_quotes: true });
  if (!records.length) return { adapter: null, rows: [] };
  const headers = Object.keys(records[0]);
  const adapters = loadAdapters();
  const chosen = chooseAdapter(headers, adapters);

  if (!chosen) {
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

  const adapter = adapters.find(a => a.id === chosen.id)!;
  const mapped = mapToCanonical(adapter as any, records).map(r => ({
    booking_date: r.bookingDate!,
    value_date: r.valueDate,
    amount: r.amount!,
    currency: r.currency,
    purpose: r.purpose,
    counterpart_name: r.counterpartName,
  }));
  return { adapter: { bankName: adapter.meta?.bank || adapter.id, id: adapter.id }, rows: mapped };
}


