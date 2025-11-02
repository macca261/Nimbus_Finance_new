import { CanonicalRow, CsvRow, ParseCtx, normalizeWs, parseDeDate, parseEuroToCents } from '../utils.js';

export const id = 'de.sparkasse.csv';

const REQUIRED = [
  'Auftragskonto','Buchungstag','Valutadatum','Buchungstext','Verwendungszweck','Begünstigter/Zahlungspflichtiger','Kontonummer','BLZ','Betrag','Währung'
];

function norm(s: string) {
  return s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function hasHeaders(headers: string[], needed: string[]): boolean {
  const set = new Set(headers.map(norm));
  return needed.every(h => set.has(norm(h)));
}

export function matches(headers: string[]): boolean {
  return hasHeaders(headers, REQUIRED);
}

export function parse(rows: CsvRow[], _ctx: ParseCtx): CanonicalRow[] {
  const out: CanonicalRow[] = [];
  for (const r of rows) {
    const bookingDate = parseDeDate(r['Buchungstag']);
    const valueDate = parseDeDate(r['Valutadatum']);
    const amountCents = parseEuroToCents(r['Betrag']);
    const currency = (r['Währung'] || 'EUR');
    const purpose = normalizeWs(`${r['Buchungstext'] ?? ''} ${r['Verwendungszweck'] ?? ''}`);
    const counterpartName = r['Begünstigter/Zahlungspflichtiger'] ?? '';
    const accountIban = (r['IBAN'] ?? '').replace(/\s+/g,'');
    const rawCode = r['Umsatzart'] || r['Buchungstext'] || '';
    out.push({ bookingDate, valueDate, amountCents, currency, purpose, counterpartName, accountIban, rawCode });
  }
  return out;
}


