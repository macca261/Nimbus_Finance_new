import { normalizeAmount, pick, normalizeDate } from '../normalize.js';
import type { ParsedTransaction } from '../types.js';

const H = {
  bookingDate: ['Buchungstag', 'Buchungsdatum', 'Datum'],
  valueDate: ['Valuta', 'Wertstellung', 'Valutadatum'],
  amount: ['Betrag', 'Umsatz', 'Betrag (EUR)'],
  purpose: ['Verwendungszweck', 'Buchungstext', 'Beschreibung'],
  counterpart: ['Auftraggeber', 'Empfänger', 'Begünstigter', 'Name'],
  iban: ['IBAN', 'Gegenkonto IBAN'],
  bic: ['BIC', 'Gegenkonto BIC'],
};

export function parse(rows: Record<string, string>[]): ParsedTransaction[] {
  return rows.map((r) => ({
    bank: 'commerzbank',
    bookingDate: normalizeDate(pick(r, H.bookingDate))!,
    valueDate: normalizeDate(pick(r, H.valueDate), true),
    amount: normalizeAmount(pick(r, H.amount)),
    currency: 'EUR',
    description: [pick(r, H.purpose)].filter(Boolean).join(' '),
    counterparty: pick(r, H.counterpart),
    iban: pick(r, H.iban),
    bic: pick(r, H.bic),
    raw: r,
  }));
}

