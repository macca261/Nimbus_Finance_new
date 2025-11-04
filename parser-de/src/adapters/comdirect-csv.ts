import { parse as csvParse } from 'csv-parse/sync';

export const id = 'de.comdirect.csv';

function toLines(text: string): string[] {
  return text.replace(/^\uFEFF/, '').split(/\r?\n/);
}

function normalizeDeDate(input?: string): string | undefined {
  if (!input) return undefined;
  const s = String(input).trim();
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (!m) return undefined;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return `${year}-${String(Number(m[2])).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`;
}

export function parseGermanAmountToCents(input?: string): number {
  if (input == null) return 0;
  let s = String(input).trim();
  if (!s) return 0;
  const neg = s.startsWith('-') || s.endsWith('-') || /^\(.*\)$/.test(s);
  s = s.replace(/[()\-+]/g, '').replace(/[.']/g, '').replace(/,([0-9]{1,})$/, '.$1');
  const n = Math.round(Number(s) * 100);
  if (!Number.isFinite(n)) return 0;
  return neg ? -Math.abs(n) : n;
}

export function detect(buffer: Buffer): boolean {
  const text = buffer.toString('utf8');
  const lines = toLines(text).filter(l => l.trim().length > 0);
  const headerNeedle = '"Buchungstag";"Wertstellung (Valuta)";"Vorgang";"Buchungstext";"Umsatz in EUR"';
  return lines.some(l => l.includes('"Umsätze Girokonto"')) || lines.some(l => l.trim().startsWith('"Buchungstag"') && l.includes('"Umsatz in EUR"')) || lines.some(l => l.includes(headerNeedle));
}

export function parse(buffer: Buffer): Array<{
  bookingDate: string;
  valueDate?: string;
  amountCents: number;
  currency: string;
  purpose?: string;
  counterpartName?: string;
  accountIban?: string;
  rawCode?: string;
}> {
  const text = buffer.toString('utf8');
  const lines = toLines(text);
  const startIdx = lines.findIndex(l => l.trim().startsWith('"Buchungstag"'));
  if (startIdx === -1) throw new Error('Comdirect: header not found');
  const payload = lines.slice(startIdx).join('\n');
  let rows: any[] = [];
  try {
    rows = csvParse(payload, {
      columns: true,
      delimiter: ';',
      quote: '"',
      bom: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
      trim: true,
    });
  } catch (e: any) {
    throw new Error('Comdirect: CSV parse failed');
  }
  const out: any[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const bookingRaw = r['Buchungstag'] || r['"Buchungstag"'];
    const valueRaw = r['Wertstellung (Valuta)'] || r['"Wertstellung (Valuta)"'];
    const vorgang = (r['Vorgang'] || '').toString().trim() || undefined;
    const purpose = (r['Buchungstext'] || '').toString().trim() || undefined;
    const amountRaw = r['Umsatz in EUR'] ?? r['"Umsatz in EUR"'];
    if (!bookingRaw && !valueRaw && !purpose && !amountRaw) continue;
    const bookingDate = normalizeDeDate(String(bookingRaw));
    const valueDate = normalizeDeDate(String(valueRaw));
    if (!bookingDate) {
      throw new Error(`Comdirect: invalid date on row ${i + 1}`);
    }
    const amountCents = parseGermanAmountToCents(String(amountRaw ?? '0'));
    out.push({ bookingDate, valueDate, amountCents, currency: 'EUR', purpose, counterpartName: undefined, accountIban: '', rawCode: vorgang });
  }
  return out;
}


