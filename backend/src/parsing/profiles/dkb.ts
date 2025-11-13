import type { ParserProfile } from '../profileTypes';

export { profile as dkbProfile };

const profile: ParserProfile = {
  id: 'dkb',
  locale: 'de-DE',
  detection: {
    requiredHeaderTokens: [
      'buchungstag',
      'wertstellung',
      'buchungstyp',
      'auftraggeber',
      'empfänger',
      'verwendungszweck',
      'betrag',
      'währung',
    ],
    delimiter: ';',
    encodingHints: ['utf8', 'windows-1252'],
  },
  columns: {
    bookingDate: ['Buchungstag'],
    valutaDate: ['Wertstellung'],
    amount: ['Betrag'],
    currency: ['Währung'],
    text: ['Verwendungszweck', 'Buchungstyp'],
    counterparty: ['Auftraggeber / Empfänger', 'Auftraggeber', 'Empfänger'],
  },
  formats: { date: ['dd.MM.yyyy'], decimalComma: true, thousandSep: '.' },
  rules: { skipIfZeroAmount: true },
  derive: { accountIdTemplate: 'dkb:<iban|wallet>' },
};


