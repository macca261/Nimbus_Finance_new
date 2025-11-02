import { CanonicalRow, CsvRow, ParseCtx, normalizeWs, parseDeDate, parseEuroToCents } from '../utils.js';

export const id = 'de.dkb.csv';

function norm(s: string) { return s.trim().toLowerCase(); }

function hasHeaders(headers: string[], variants: string[][]): boolean {
  const set = new Set(headers.map(h => norm(h)));
  return variants.some(cols => cols.every(c => set.has(norm(c))));
}

export function matches(headers: string[]): boolean {
  const trimmed = headers.map(h => h.trim());
  const hasV1 = hasHeaders(trimmed, [['Buchungstag','Wertstellung','Verwendungszweck','Betrag (EUR)']]);
  if (hasV1) return true;
  const hasV2core = hasHeaders(trimmed, [['Buchungstag','Wertstellung','Buchungstext','Betrag']]);
  if (!hasV2core) return false;
  const set = new Set(trimmed.map(h => norm(h)));
  const hasDkbSpecific = set.has(norm('Buchungsart')) || set.has(norm('Begünstigter')) || set.has(norm('Auftraggeber'));
  const looksLikeCommerz = set.has(norm('Umsatzart'));
  return hasDkbSpecific && !looksLikeCommerz;
}

export function parse(rows: CsvRow[], _ctx: ParseCtx): CanonicalRow[] {
  const out: CanonicalRow[] = [];
  for (const r of rows) {
    const bookingDate = parseDeDate(r['Buchungstag']);
    const valueDate = parseDeDate(r['Wertstellung']);
    const purpose = normalizeWs(`${r['Buchungstext'] ?? ''} ${r['Verwendungszweck'] ?? ''}`);
    const amountCents = parseEuroToCents(r['Betrag (EUR)'] ?? r['Betrag']);
    const currency = 'EUR';
    const counterpartName = r['Begünstigter'] ?? r['Auftraggeber'] ?? '';
    const accountIban = (r['IBAN'] ?? '').replace(/\s+/g,'');
    const rawCode = r['Buchungsart'] ?? r['Buchungstext'] ?? '';
    out.push({ bookingDate, valueDate, amountCents, currency, purpose, counterpartName, accountIban, rawCode });
  }
  return out;
}


