export type CanonicalRow = {
  bookingDate: string;
  valueDate?: string;
  amountCents: number;
  currency?: string;
  purpose?: string;
  counterpartName?: string;
  accountIban?: string;
  rawCode?: string;
};

function normalizeDeDate(input?: string): string | undefined {
  if (!input) return undefined;
  const s = String(input).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (!m) return undefined;
  const yy = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return `${yy}-${String(Number(m[2])).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`;
}

function parseEuroToCents(input?: string): number {
  if (input == null) return 0;
  let s = String(input).trim();
  if (!s) return 0;
  const isNeg = s.startsWith('-') || s.endsWith('-') || /^\(.*\)$/.test(s);
  s = s.replace(/[()\-+]/g, '').replace(/[.']/g, '').replace(/,([0-9]{1,})$/, '.$1');
  const n = Math.round(Number(s) * 100);
  if (!Number.isFinite(n)) return 0;
  return isNeg ? -Math.abs(n) : n;
}

export const id = 'de.comdirect.csv';

export function detect(headers: string[]): boolean {
  const lc = headers.map(h => h.trim().toLowerCase());
  const has = (h: string) => lc.includes(h.toLowerCase());
  const hasAny = (...arr: string[]) => arr.some(x => has(x));
  return has('buchungstag') && hasAny('buchungstext', 'verwendungszweck') && hasAny('betrag', 'umsatz', 'betrag (eur)');
}

export function parse(rows: any[]): CanonicalRow[] {
  const out: CanonicalRow[] = [];
  for (const r of rows) {
    const booking = r['Buchungstag'] ?? r['Buchung'] ?? r['Datum'] ?? '';
    const value = r['Wertstellung'] ?? r['Valutadatum'] ?? '';
    const currency = r['Währung'] ?? r['Waehrung'] ?? r['Currency'] ?? 'EUR';
    const purpose = [r['Buchungstext'], r['Verwendungszweck']].filter(Boolean).join(' ').trim() || undefined;
    const name = r['Begünstigter/Zahlungspflichtiger'] ?? r['Auftraggeber/Empfänger'] ?? r['Name'] ?? undefined;
    const iban = (r['IBAN'] ?? '').toString().replace(/\s+/g, '') || undefined;
    const rawCode = r['Umsatzart'] ?? r['Kategorie'] ?? r['Code'] ?? undefined;
    const belastung = (r['Soll/Haben'] ?? r['Belastung/Gutschrift'] ?? '').toString().toLowerCase();
    const amountRaw = r['Betrag'] ?? r['Umsatz'] ?? r['Betrag (EUR)'] ?? '0';
    let cents = parseEuroToCents(String(amountRaw));
    if (cents === Math.abs(cents)) {
      if (/(soll|belast)/.test(belastung)) cents = -Math.abs(cents);
      else if (/(haben|gutschrift)/.test(belastung)) cents = Math.abs(cents);
    }
    const bookingDate = normalizeDeDate(String(booking));
    const valueDate = normalizeDeDate(String(value));
    if (!bookingDate) continue;
    out.push({ bookingDate, valueDate, amountCents: cents, currency, purpose, counterpartName: name, accountIban: iban, rawCode });
  }
  return out;
}


