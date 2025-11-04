// packages/parser-de/src/adapters/comdirect-giro.ts
import { parse as parseCsv } from 'csv-parse/sync';
import iconv from 'iconv-lite';

export const id = 'de.comdirect.csv.giro';

type Canonical = {
  bookingDate: string;
  valueDate: string;
  amountCents: number;
  currency: string;
  purpose: string;
  counterpartName: string;
  accountIban: string;
  rawCode: string;
};

export function detect(buf: Buffer): boolean {
  const { text } = decodeWithFallback(buf);
  const lines = splitLines(text).slice(0, 60);
  const hasTitle = lines.some(l => /"Umsätze\s+Girokonto"/i.test(l) || /Umsätze\s+Girokonto/i.test(l));
  const hasHeader = lines.some(isHeaderLine);
  return hasTitle && hasHeader;
}

export function parse(buf: Buffer) {
  const { text, encoding } = decodeWithFallback(buf);
  const lines = splitLines(text);

  // Find the header row index
  const headerIdx = lines.findIndex(isHeaderLine);
  if (headerIdx < 0) {
    return { adapterId: id, rows: [], _debug: { encoding, headerIdx } };
  }

  // Body from header line onward
  const body = lines.slice(headerIdx).join('\n');

  // Parse with ; and "
  const records: any[] = parseCsv(body, {
    delimiter: ';',
    quote: '"',
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
    bom: true,
    trim: true,
  });

  const rows: Canonical[] = records.map((r) => {
    const buchungstag = pick(r, ['Buchungstag', 'Buchungsdatum']);
    const wertstellung = pick(r, ['Wertstellung (Valuta)', 'Wertstellung', 'Valuta']);
    const vorgang = pick(r, ['Vorgang', 'Umsatzart']) || '';
    const buchungstext = pick(r, ['Buchungstext', 'Verwendungszweck', 'Buchungsdetails']) || '';
    const umsatz = pick(r, ['Umsatz in EUR', 'Umsatz', 'Betrag', 'Betrag (EUR)']);
    const normalized = normalizePurpose(String(buchungstext || ''));

    return {
      bookingDate: toIsoDate(buchungstag),
      valueDate: toIsoDate(wertstellung) || toIsoDate(buchungstag),
      amountCents: toCents(umsatz),
      currency: 'EUR',
      purpose: normalized.purpose,
      counterpartName: '',
      accountIban: '',
      rawCode: [String(vorgang).trim(), normalized.rawCode].filter(Boolean).join(' ').trim(),
    };
  }).filter(t => t.bookingDate && Number.isFinite(t.amountCents));

  return { adapterId: id, rows, _debug: { encoding, headerIdx, columns: Object.keys(records?.[0] || {}) } };
}

/* ---------- helpers ---------- */

function splitLines(s: string) {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

function decodeWithFallback(buf: Buffer): { text: string; encoding: 'utf8' | 'cp1252' } {
  // try utf-8(-bom)
  try {
    const s = buf.toString('utf8');
    if (s.includes('Buchungstag') || s.includes('Umsätze') || s.includes('Wertstellung')) {
      return { text: s, encoding: 'utf8' };
    }
  } catch {}
  const s2 = iconv.decode(buf, 'cp1252');
  return { text: s2, encoding: 'cp1252' };
}

// Header variants Comdirect uses
function isHeaderLine(l: string) {
  const norm = l.trim().replace(/^;+/, '').replace(/;+$/, ''); // drop stray leading/trailing semicolons
  return /^"?Buchungstag"?;?"?Wertstellung(?:\s*\(Valuta\))?"?;?"?(Vorgang|Umsatzart)"?;?"?(Buchungstext|Verwendungszweck|Buchungsdetails)"?;?"?(Umsatz(?:\s*in\s*EUR)?|Betrag(?:\s*\(EUR\))?)"?$/i.test(norm);
}

function pick(obj: any, keys: string[]) {
  for (const k of keys) {
    if (obj && obj[k] != null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

function toIsoDate(s?: string) {
  if (!s) return '';
  const m = String(s).trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function toCents(input?: string | number) {
  if (typeof input === 'number') return Math.round(input * 100);
  const raw = String(input ?? '').replace(/\s|€|EUR/gi, '').trim();
  if (!raw) return NaN;
  // DE: decimal comma, thousands dot; also accept negatives like "1.234,56-" or "(1.234,56)"
  const s1 = raw.replace(/\(|\)/g, '');
  const neg = /-$/.test(s1) ? -1 : 1;
  const s2 = s1.replace(/-$/, '');
  const normalized = s2.includes(',')
    ? s2.replace(/\./g, '').replace(',', '.')
    : s2;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) * neg : NaN;
}

export function normalizePurpose(rawPurpose: string): { purpose: string; rawCode?: string } {
  let text = (rawPurpose ?? '').replace(/\u0000/g, '').trim();
  if (!text) return { purpose: '' };

  const rawSegments: string[] = [];

  text = text.replace(/^Buchungstext:\s*/i, '');

  const auftragMatch = text.match(/^Auftraggeber:\s*([^]+?)\s+Buchungstext:\s*(.+)$/i);
  if (auftragMatch) {
    text = auftragMatch[2].trim();
  }

  const collect = (pattern: RegExp) => {
    text = text.replace(pattern, (match) => {
      rawSegments.push(match.trim());
      return ' ';
    });
  };

  collect(/\bRef\.?[:\-]?\s*[A-Z0-9\-]+/gi);
  collect(/\b(?:EREF|KREF|MREF|CRED|SVWZ)[+:-][^\s]+/gi);
  collect(/\bID[:\s-]*[A-Z0-9]{6,}\b/gi);

  text = text.replace(/\s+/g, ' ').trim();

  const stopWords = ['REF', 'EREF', 'KREF', 'MREF', 'SVWZ', 'BIC', 'IBAN', 'ID', 'KARTENENTGELT', 'GEBUEHR', 'GEBÜHR'];
  const tokens = text.split(' ');
  const merchantTokens: string[] = [];
  for (const token of tokens) {
    const upper = token.toUpperCase();
    if (stopWords.some(sw => upper.startsWith(sw))) break;
    if (/^[0-9]{3,}$/.test(token) && merchantTokens.length) break;
    merchantTokens.push(token);
    if (merchantTokens.length >= 6) break;
  }

  const merchant = merchantTokens.join(' ').trim();
  const purpose = merchant || text;

  return {
    purpose,
    rawCode: rawSegments.length ? rawSegments.join(' ') : undefined,
  };
}


