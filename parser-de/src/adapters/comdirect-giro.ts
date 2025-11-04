import { parse as csvParse } from 'csv-parse/sync';

export const id = 'de.comdirect.csv.giro';

function toLines(text: string): string[] { return text.replace(/^\uFEFF/, '').split(/\r?\n/); }

function normalizeDeDate(input?: string): string | undefined {
  if (!input) return undefined;
  const s = String(input).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (!m) return undefined;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return `${y}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`;
}

function parseGermanAmountToCents(input?: string): number {
  if (input == null) return 0;
  let s = String(input).trim();
  const neg = s.startsWith('-') || s.endsWith('-') || /^\(.*\)$/.test(s);
  s = s.replace(/[()\-+]/g,'').replace(/[.']/g,'').replace(/,([0-9]{1,})$/, '.$1');
  const n = Math.round(Number(s) * 100);
  if (!Number.isFinite(n)) return 0;
  return neg ? -Math.abs(n) : n;
}

export function detect(buffer: Buffer): boolean {
  const text = buffer.toString('utf8');
  const lines = toLines(text).slice(0, 30).map(l => l.trim());
  const hasPreamble = lines.some(l => l.startsWith('"Umsätze Girokonto"'));
  const headerIdx = lines.findIndex(l => l.startsWith('"Buchungstag"') && l.includes('"Umsatz in EUR"'));
  return (hasPreamble && headerIdx >= 0) || headerIdx >= 0;
}

export function parse(buffer: Buffer): Array<{ bookingDate: string; valueDate?: string; amountCents: number; currency: string; purpose?: string; counterpartName?: string; accountIban?: string; rawCode?: string; }> {
  const text = buffer.toString('utf8');
  const lines = toLines(text);
  const headerIdx = lines.findIndex(l => l.trim().startsWith('"Buchungstag"'));
  if (headerIdx < 0) throw new Error('Comdirect Giro: header not found');
  const payload = lines.slice(headerIdx).join('\n');
  let rows: any[] = [];
  try {
    rows = csvParse(payload, { columns: true, delimiter: ';', quote: '"', bom: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true, trim: true });
  } catch {
    throw new Error('Comdirect Giro: CSV parse failed');
  }
  const out: any[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const booking = r['Buchungstag'];
    const valuta = r['Wertstellung (Valuta)'] ?? r['Wertstellung'];
    const vorgang = (r['Vorgang'] ?? '').toString().trim() || undefined;
    const textField = (r['Buchungstext'] ?? '').toString().trim() || undefined;
    const amountField = r['Umsatz in EUR'];
    if (!booking && !valuta && !textField && !amountField) continue;
    const bookingDate = normalizeDeDate(booking);
    const valueDate = normalizeDeDate(valuta);
    if (!bookingDate) throw new Error(`Comdirect Giro: invalid row ${i+1}`);
    const amountCents = parseGermanAmountToCents(String(amountField ?? '0'));
    out.push({ bookingDate, valueDate, amountCents, currency: 'EUR', purpose: textField, counterpartName: '', accountIban: '', rawCode: vorgang });
  }
  return out;
}


