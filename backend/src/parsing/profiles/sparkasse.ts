import type { ParserProfile } from '../profileTypes';

export { profile as sparkasseProfile };

const profile: ParserProfile = {
  id: 'sparkasse',
  locale: 'de-DE',
  detection: {
    requiredHeaderTokens: [
      'auftragskonto',
      'buchungstag',
      'valutadatum',
      'buchungstext',
      'verwendungszweck',
      'betrag',
      'währung',
      'saldo',
    ],
    delimiter: ';',
    encodingHints: ['utf8', 'windows-1252'],
  },
  columns: {
    bookingDate: ['Buchungstag'],
    valutaDate: ['Valutadatum'],
    amount: ['Betrag'],
    currency: ['Währung'],
    text: ['Buchungstext', 'Verwendungszweck', 'Info'],
    counterparty: ['Begünstigter/Zahlungspflichtiger', 'Begünstigter', 'Zahlungspflichtiger'],
    iban: ['Auftragskonto'],
    balance: ['Saldo'],
  },
  formats: { date: ['dd.MM.yyyy'], decimalComma: true, thousandSep: '.' },
  rules: { skipIfZeroAmount: true },
  derive: { accountIdTemplate: 'sparkasse:<iban|wallet>' },
};


