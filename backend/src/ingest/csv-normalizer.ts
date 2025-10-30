import { parse } from 'csv-parse/sync';

export type CsvDialect = {
  delimiter: string; // usually ';' for German CSVs
  quote: string;
};

export function detectDialect(sample: string): CsvDialect {
  const firstLines = sample.split(/\r?\n/).slice(0, 5);
  const semicolons = firstLines.map(l => (l.match(/;/g) || []).length).reduce((a, b) => a + b, 0);
  const commas = firstLines.map(l => (l.match(/,/g) || []).length).reduce((a, b) => a + b, 0);
  const delimiter = semicolons >= commas ? ';' : ',';
  return { delimiter, quote: '"' };
}

export function parseCsvToTable(content: string, dialect?: CsvDialect): string[][] {
  const d = dialect ?? detectDialect(content);
  // csv-parse handles quoted newlines by default
  const records: string[][] = parse(content, {
    delimiter: d.delimiter,
    quote: d.quote,
    relax_quotes: true,
    relax_column_count: true,
    bom: true,
    skip_empty_lines: true,
  });
  return records;
}

export type NormalizedTable = {
  headersOriginal: string[];
  headersNormalized: string[];
  rows: string[][];
};

export function normalizeTable(table: string[][]): NormalizedTable {
  if (!table.length) return { headersOriginal: [], headersNormalized: [], rows: [] };
  const headersOriginal = table[0].map(h => String(h ?? ''));
  const headersNormalized = headersOriginal.map(normalizeHeader);
  const rows = table.slice(1);
  return { headersOriginal, headersNormalized, rows };
}

function normalizeHeader(h: string): string {
  const base = stripDiacritics(h).trim().toLowerCase();
  // Typical German banking headers mapping to canonical keys
  const normalized = base
    .replace(/\s+/g, ' ')
    .replace(/\//g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, '_');

  // Special cases
  const table: Record<string, string> = {
    buchungstag: 'bookingDate',
    buchungsdatum: 'bookingDate',
    valutadatum: 'valueDate',
    waehrung: 'currency',
    wahrung: 'currency',
    betrag: 'amount',
    betrag_eur: 'amount',
    verwendungszweck: 'purpose',
    buchungstext: 'purpose',
    umsatzart: 'txType',
    auftraggeber_beguenstigter: 'counterpartName',
    beguenstigter_zahlungspflichtiger: 'counterpartName',
    iban: 'counterpartIban',
    bic: 'counterpartBic',
    end_to_end_id: 'endToEndId',
    endtoendid: 'endToEndId',
    mandat_referenz: 'mandateRef',
    mandatreferenz: 'mandateRef',
    glaeubiger_id: 'creditorId',
    glaubigerid: 'creditorId',
    primanota: 'rawCode',
    buchungscode: 'rawCode',
  };

  if (table[normalized]) return table[normalized];

  return normalized;
}

function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}


