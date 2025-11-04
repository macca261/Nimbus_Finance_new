import { normalizeAmount, pick, normalizeDate } from '../normalize.js';
import type { ParsedTransaction } from '../types.js';

const H = {
  bookingDate: ['Buchungsdatum', 'Buchungstag', 'Buchung'],
  valueDate: ['Wertstellung', 'Valutadatum'],
  amount: ['Betrag', 'Betrag (EUR)'],
  purpose: ['Verwendungszweck', 'Text'],
  counterpart: ['Auftraggeber/Empfänger', 'Begünstigter/Zahlungspflichtiger', 'Name'],
  iban: ['IBAN', 'Gegenkonto IBAN'],
  bic: ['BIC', 'Gegenkonto BIC'],
};

export function parse(rows: Record<string, string>[]): ParsedTransaction[] {
  return rows.map((r) => ({
    bank: 'ing',
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

