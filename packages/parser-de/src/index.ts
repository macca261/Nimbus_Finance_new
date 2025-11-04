import { parse as parseCsv } from 'csv-parse/sync';
import iconv from 'iconv-lite';
import { CsvRow, CanonicalRow, ParseCtx, normalizeWs, parseDeDate, parseEuroToCents, detectEncoding } from './utils.js';
import * as comdirect from './adapters/comdirect.js';
import * as comdirectGiro from './adapters/comdirect-giro.js';
import { id as idCommerz, matches as mCommerz, parse as pCommerz } from './adapters/commerzbank_csv.js';
import { id as idSpark, matches as mSpark, parse as pSpark } from './adapters/sparkasse_csv.js';
import * as ing from './adapters/ing_csv.js';
import * as dkb from './adapters/dkb_csv.js';

export type ParsedRow = {
  bookingDate: string; // ISO yyyy-MM-dd
  valueDate?: string;  // ISO yyyy-MM-dd
  amountCents: number;
  currency?: string;
  purpose?: string;
  counterpartName?: string;
  accountIban?: string;
  rawCode?: string;
};

export type ParseResult =
  | { adapterId: string; rows: ParsedRow[]; headers: string[]; sample: string[][]; needsMapping?: false }
  | { needsMapping: true; headers: string[]; sample: string[][] };

export type ParseOptions = {
  delimiter?: string;
};

const ADAPTERS = [
  idCommerz,
  idSpark,
  'generic_de',
  'n26_en',
];

export function listAdapters() {
  return ADAPTERS.slice();
}

// detectEncoding is imported from utils

function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/)[0] || '';
  const candidates = [',', ';', '\t', '|'];
  let best: { d: string; count: number } = { d: ',', count: 0 };
  for (const d of candidates) {
    const c = (first.match(new RegExp(`\\${d}`, 'g')) || []).length;
    if (c > best.count) best = { d, count: c };
  }
  return best.d;
}

function toCents(amountStr: string): number {
  // de-DE style: 1.234,56- or -1.234,56 or 1,23
  const s = amountStr.trim();
  return parseEuroToCents(s);
}

function normalizeDate(s: string): string {
  // Accept dd.MM.yyyy or yyyy-MM-dd
  const d = parseDeDate(s);
  if (d) return d;
  throw Object.assign(new Error('Invalid date'), { code: 'INVALID_DATE' });
}

function tryGenericDE(headers: string[], rows: string[][]) {
  // Common German CSV headers
  const map: Record<string, number> = {};
  headers.forEach((h, i) => { map[h.toLowerCase()] = i; });
  const idxDate = map['buchungstag'] ?? map['buchungstag'] ?? map['valuta'] ?? map['booking date'] ?? map['datum'];
  const idxAmount = map['betrag'] ?? map['amount'] ?? map['umsatz'];
  const idxCurrency = map['währung'] ?? map['currency'];
  const idxPurpose = map['verwendungszweck'] ?? map['beschreibung'] ?? map['purpose'];
  if (idxDate == null || idxAmount == null) return null;
  const out: ParsedRow[] = [];
  for (const r of rows) {
    try {
      const bookingDate = normalizeDate(r[idxDate] || '');
      const amountCents = toCents(r[idxAmount] || '0');
      out.push({ bookingDate, amountCents, currency: idxCurrency!=null? r[idxCurrency] : 'EUR', purpose: idxPurpose!=null? r[idxPurpose]: undefined });
    } catch {}
  }
  if (!out.length) return null;
  return { adapterId: 'generic_de', rows: out } as const;
}

function tryN26EN(headers: string[], rows: string[][]) {
  const lower = headers.map(h => h.toLowerCase());
  const idxDate = lower.indexOf('date');
  const idxAmount = lower.indexOf('amount (eur)');
  const idxPayee = lower.indexOf('payee');
  if (idxDate === -1 || idxAmount === -1) return null;
  const out: ParsedRow[] = [];
  for (const r of rows) {
    try {
      const bookingDate = normalizeDate(r[idxDate] || '');
      const amountCents = toCents(r[idxAmount] || '0');
      out.push({ bookingDate, amountCents, currency: 'EUR', counterpartName: idxPayee!==-1? r[idxPayee]: undefined });
    } catch {}
  }
  if (!out.length) return null;
  return { adapterId: 'n26_en', rows: out } as const;
}

export function parseBufferAuto(buf: Buffer, opts: ParseOptions = {}): ParseResult {
  // Prefer specialized Comdirect Giro detector that can handle preambles
  try {
    if (comdirectGiro.detect(buf)) {
      const out = comdirectGiro.parse(buf) as any;
      const headers = Array.isArray(out?._debug?.columns) ? out._debug.columns : [];
      return { adapterId: out.adapterId, rows: out.rows, headers, sample: [], _debug: out._debug } as any;
    }
  } catch {}
  const enc = detectEncoding(buf);
  const text = iconv.decode(buf, enc === 'cp1252' ? 'win1252' : enc);
  const delim = opts.delimiter || detectDelimiter(text);
  const records = parseCsv(text, { delimiter: delim, relaxQuotes: true, skipEmptyLines: true });
  const [headerRow, ...dataRows] = records as string[][];
  if (!dataRows.length) {
    throw Object.assign(new Error('No rows found'), { code: 'NO_ROWS' });
  }
  const headers = headerRow.map(h => String(h));
  const sample = dataRows.slice(0, 5).map(r => r.map(String));
  const objRows: CsvRow[] = dataRows.map(r => {
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => { rec[String(h)] = String(r[i] ?? ''); });
    return rec;
  });

  const ctx: ParseCtx = { parseDeDate, parseEuroToCents, normalizeWs };

  // Specialized German bank adapters first
  const banks: Array<{ id: string; matches: (headers: string[]) => boolean; parse: (rows: CsvRow[], ctx: ParseCtx) => CanonicalRow[] }>= [
    // Prefer more specific adapters first
    { id: idCommerz, matches: mCommerz, parse: pCommerz },
    { id: idSpark, matches: mSpark, parse: pSpark },
    { id: dkb.id, matches: dkb.matches, parse: dkb.parse },
    { id: ing.id, matches: ing.matches, parse: ing.parse },
    // Generic-ish Comdirect CSV last
    { id: comdirect.id, matches: comdirect.matches, parse: comdirect.parse },
  ];
  const trimmedHeaders = headers.map(h => String(h).trim().replace(/^\uFEFF/, ''));
  for (const a of banks) {
    try {
      if (a.matches(trimmedHeaders)) {
        const rows = a.parse(objRows, ctx);
        if (rows.length > 0) return { adapterId: a.id, rows: rows as ParsedRow[], headers, sample };
      }
    } catch {}
  }

  // Try adapters
  const attempts = [tryGenericDE(headers, dataRows), tryN26EN(headers, dataRows)];
  for (const a of attempts) {
    if (a && a.rows.length > 0) {
      return { adapterId: a.adapterId, rows: a.rows, headers, sample };
    }
  }
  const err = new Error(`No parsable rows. Detected encoding=${enc}, delimiter='${delim}'. Headers=[${headers.join(', ')}]`);
  (err as any).code = 'NO_ROWS';
  throw err;
}


