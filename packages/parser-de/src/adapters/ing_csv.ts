import { CanonicalRow, CsvRow, ParseCtx, normalizeWs, parseDeDate, parseEuroToCents } from '../utils.js';

export const id = 'de.ing.csv';

function norm(s: string) { return s.trim().toLowerCase(); }

function hasAll(headers: string[], cols: string[]): boolean {
  const set = new Set(headers.map(h => norm(h)));
  return cols.every(c => set.has(norm(c)));
}

export function matches(headers: string[]): boolean {
  const A = [ 'Buchung', 'Verwendungszweck', 'Betrag', 'Währung' ];
  const B = [ 'Buchung', 'Buchungstext', 'Betrag', 'Währung' ];
  const set = headers.map(h => h.trim());
  return hasAll(set, A) || hasAll(set, B);
}

export function parse(rows: CsvRow[], _ctx: ParseCtx): CanonicalRow[] {
  const out: CanonicalRow[] = [];
  for (const r of rows) {
    const bookingDate = parseDeDate(r['Buchung']);
    const valueDate = parseDeDate(r['Wertstellung']);
    const purpose = normalizeWs((r['Buchungstext'] ?? r['Verwendungszweck'] ?? ''));
    let amountCents = 0;
    if (r['Haben'] || r['Soll']) {
      if (r['Haben']) amountCents = parseEuroToCents(r['Haben']);
      else if (r['Soll']) amountCents = -Math.abs(parseEuroToCents(r['Soll']));
    } else {
      amountCents = parseEuroToCents(r['Betrag']);
    }
    const currency = (r['Währung'] ?? 'EUR');
    const counterpartName = r['Auftraggeber/Empfänger'] ?? '';
    const accountIban = (r['IBAN'] ?? '').replace(/\s+/g,'');
    const rawCode = r['Kategorie'] ?? r['Buchungstext'] ?? '';
    out.push({ bookingDate, valueDate, amountCents, currency, purpose, counterpartName, accountIban, rawCode });
  }
  return out;
}


