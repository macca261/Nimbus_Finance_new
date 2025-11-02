import { CanonicalRow, CsvRow, ParseCtx, normalizeWs, parseDeDate, parseEuroToCents } from '../utils.js';

export const id = 'de.commerzbank.csv';

const REQUIRED = [
  'Buchungstag','Wertstellung','Umsatzart','Buchungstext','Betrag','Währung',
];
const ANY_OF = ['Auftraggeberkonto','Bankleitzahl','IBAN'];

function norm(s: string) {
  return s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function hasHeaders(headers: string[], needed: string[]): boolean {
  const set = new Set(headers.map(norm));
  return needed.every(h => set.has(norm(h)));
}

export function matches(headers: string[]): boolean {
  const trimmed = headers.map(h => h.trim());
  const set = new Set(trimmed.map(norm));
  return hasHeaders(trimmed, REQUIRED) && ANY_OF.some(h => set.has(norm(h)));
}

export function parse(rows: CsvRow[], _ctx: ParseCtx): CanonicalRow[] {
  const out: CanonicalRow[] = [];
  for (const r of rows) {
    const bookingDate = parseDeDate(r['Buchungstag']);
    const valueDate = parseDeDate(r['Wertstellung']);
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


