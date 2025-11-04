import { parseGermanMoneyToCents } from './utils/deMoney';
import { decodeBufferSmart } from './utils/encoding';
import { findHeaderIndex, HeaderShape } from './utils/headerDetect';

export interface ParsedRow {
  bookingDate: string;
  valueDate: string;
  amountCents: number;
  currency: string;
  purpose: string;
  counterpartName: string | null;
  accountIban: string | null;
  rawCode: string | null;
}

export interface ParseResult {
  adapterId: string;
  rows: ParsedRow[];
  _debug?: any;
}

/** main entry – called from server upload flow with raw buffer */
export function parseGermanCSV(buffer: Buffer): ParseResult {
  const { text, encoding } = decodeBufferSmart(buffer);
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  const headerMeta = findHeaderIndex(lines);
  if (!headerMeta) {
    throw new Error('Kein Tabellenkopf erkannt – prüfen Sie Trennzeichen (; oder ,) und Format.');
  }

  const { headerIdx, shape, columns, delim } = headerMeta;
  const dataLines = lines.slice(headerIdx + 1).filter(l => l.trim().length > 0);

  const rows: ParsedRow[] = [];
  for (const raw of dataLines) {
    // robust delimiter split with quotes
    const cols = splitDelimited(raw, delim);
    if (cols.length < 3) continue;

    if (shape === 'comdirect_giro') {
      // Expect columns similar to:
      // Buchungstag;Wertstellung (Valuta);Vorgang;Buchungstext;Umsatz in EUR
      const map = indexMap(columns);
      const booking = get(cols, map, 'buchungstag');
      const valuta = get(cols, map, 'wertstellung (valuta)') || booking;
      const text = get(cols, map, 'buchungstext') || get(cols, map, 'verwendungszweck') || '';
      const amount = get(cols, map, 'umsatz in eur') || get(cols, map, 'umsatz') || '';
      const cents = parseGermanMoneyToCents(amount);
      if (!booking) continue;

      rows.push({
        bookingDate: normalizeDate(booking),
        valueDate: normalizeDate(valuta || booking),
        amountCents: cents,
        currency: 'EUR',
        purpose: text,
        counterpartName: null,
        accountIban: null,
        rawCode: null,
      });
    } else if (shape === 'generic_simple') {
      // simple test sample: bookingDate,valueDate,amountCents,currency,purpose
      const map = indexMap(columns);
      const booking = get(cols, map, 'bookingdate');
      const valuta = get(cols, map, 'valuedate') || booking;
      const cents = Number(get(cols, map, 'amountcents') || 0);
      const curr = get(cols, map, 'currency') || 'EUR';
      const text = get(cols, map, 'purpose') || '';
      if (!booking) continue;

      rows.push({
        bookingDate: normalizeDate(booking),
        valueDate: normalizeDate(valuta),
        amountCents: Math.round(cents),
        currency: curr || 'EUR',
        purpose: text,
        counterpartName: null,
        accountIban: null,
        rawCode: null,
      });
    } else if (shape === 'generic_de') {
      // generic german bank CSV
      const map = indexMap(columns);
      const booking = get(cols, map, 'datum') || get(cols, map, 'buchungstag');
      const valuta = get(cols, map, 'wertstellung') || get(cols, map, 'valuta') || get(cols, map, 'wertstellung (valuta)') || booking;
      const text = get(cols, map, 'verwendungszweck') || get(cols, map, 'buchungstext') || get(cols, map, 'text') || '';
      const amount = get(cols, map, 'betrag') || get(cols, map, 'umsatz') || get(cols, map, 'umsatz in eur') || '';
      const cents = parseGermanMoneyToCents(amount);
      if (!booking) continue;

      rows.push({
        bookingDate: normalizeDate(booking),
        valueDate: normalizeDate(valuta || booking),
        amountCents: cents,
        currency: 'EUR',
        purpose: text,
        counterpartName: null,
        accountIban: null,
        rawCode: null,
      });
    } else {
      // generic fallback: first row was header; try broad aliases
      const map = indexMap(columns);
      const booking = getAny(cols, map, ['buchungstag', 'datum', 'date', 'bookingdate']);
      const valuta = getAny(cols, map, ['wertstellung (valuta)', 'wertstellung', 'valuta', 'valuedate', 'valueDate']) || booking;
      const text = getAny(cols, map, ['verwendungszweck', 'buchungstext', 'text', 'purpose', 'beschreibung']);
      const amtStr = getAny(cols, map, ['umsatz in eur', 'umsatz', 'betrag', 'amount', 'amountcents']) || '';
      const cents = /amountcents/i.test(Object.keys(map).join(',')) ? Math.round(Number(amtStr)) : parseGermanMoneyToCents(amtStr);
      if (!booking) continue;

      rows.push({
        bookingDate: normalizeDate(booking),
        valueDate: normalizeDate(valuta || booking),
        amountCents: cents,
        currency: 'EUR',
        purpose: text || '',
        counterpartName: null,
        accountIban: null,
        rawCode: null,
      });
    }
  }

  let adapterId = 'generic_de';
  if (shape === 'comdirect_giro') {
    adapterId = 'de.comdirect.csv.giro';
  } else if (shape === 'generic_simple') {
    adapterId = 'generic_simple';
  } else if (shape === 'generic_de') {
    adapterId = 'generic_de';
  } else {
    adapterId = 'generic_fallback';
  }

  return {
    adapterId,
    rows,
    _debug: { encoding, headerIdx, columns, shape, delim },
  };
}

// ---------- helpers ----------
function splitDelimited(line: string, delim: ';' | ','): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      q = !q;
      continue;
    }
    if (ch === delim && !q) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function indexMap(cols: string[]): Record<string, number> {
  const m: Record<string, number> = {};
  cols.forEach((c, i) => (m[c.trim().toLowerCase()] = i));
  return m;
}
function get(row: string[], map: Record<string, number>, key: string): string | '' {
  const idx = map[key];
  return typeof idx === 'number' ? row[idx] : '';
}

function getAny(row: string[], map: Record<string, number>, keys: string[]): string {
  for (const k of keys) {
    const v = get(row, map, k.toLowerCase());
    if (v) return v;
  }
  return '';
}

function normalizeDate(s: string): string {
  if (!s) return '';
  const x = s.trim();
  // 27.10.2025 -> 2025-10-27
  const m = x.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    return `${m[3]}-${mm}-${dd}`;
  }
  // already ISO:
  if (/^\d{4}-\d{2}-\d{2}$/.test(x)) return x;
  return x; // fallback
}

