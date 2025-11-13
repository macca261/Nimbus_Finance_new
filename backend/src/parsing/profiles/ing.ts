import type { ParserProfile } from '../profileTypes';

export const ingProfile: ParserProfile = {
  id: 'ing',
  locale: 'de-DE',
  detection: {
    requiredHeaderTokens: [
      'datum',
      'name',
      'zahlungspartner',
      'konto',
      'iban',
      'verwendungszweck',
      'betrag',
      'währung',
      'typ',
    ],
    delimiter: ';',
    encodingHints: ['utf8', 'windows-1252'],
  },
  columns: {
    bookingDate: ['Datum'],
    amount: ['Betrag'],
    currency: ['Währung'],
    text: ['Verwendungszweck', 'Typ'],
    counterparty: ['Name / Zahlungspartner', 'Name', 'Zahlungspartner'],
    iban: ['Konto / IBAN', 'IBAN', 'Konto'],
  },
  formats: { date: ['dd.MM.yyyy', 'yyyy-MM-dd'], decimalComma: true, thousandSep: '.' },
  rules: { skipIfZeroAmount: true, pendingWords: ['vormerkung', 'ausstehend', 'memo'] },
  derive: { accountIdTemplate: 'ing:<iban|wallet>' },
};
