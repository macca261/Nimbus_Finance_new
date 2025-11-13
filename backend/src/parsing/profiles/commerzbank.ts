import type { ParserProfile } from '../profileTypes';

export { profile as commerzbankProfile };

const profile: ParserProfile = {
  id: 'commerzbank',
  locale: 'de-DE',
  detection: {
    requiredHeaderTokens: ['datum', 'buchungstext', 'verwendungszweck', 'betrag', 'saldo'],
    delimiter: ';',
    encodingHints: ['utf8', 'windows-1252'],
  },
  columns: {
    bookingDate: ['Datum'],
    amount: ['Betrag'],
    currency: [],
    text: ['Buchungstext', 'Verwendungszweck'],
    counterparty: ['Begünstigter'],
    balance: ['Saldo'],
  },
  formats: { date: ['dd.MM.yyyy'], decimalComma: true, thousandSep: '.' },
  rules: { skipIfZeroAmount: true },
  derive: { accountIdTemplate: 'commerzbank:<iban|wallet>' },
};


