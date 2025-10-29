export interface BankAdapter {
  bankName: string;
  version: string;
  headerPatterns: RegExp[];
  mapping: {
    bookingDate: string | string[];
    valueDate?: string | string[];
    amount: string | string[];
    purpose: string | string[];
    counterpartName?: string | string[];
  };
  quirks: {
    decimalSeparator: ',' | '.';
    dateFormat: string; // 'DD.MM.YYYY' etc.
    amountSignConvention?: 'negative' | 'parentheses' | 'soll/haben';
  };
}

export const ADAPTERS: BankAdapter[] = [
  {
    bankName: 'comdirect',
    version: 'v1',
    headerPatterns: [/Buchungstag/i, /Buchungstext/i],
    mapping: {
      bookingDate: 'Buchungstag',
      valueDate: 'Wertstellung (Valuta)',
      purpose: 'Buchungstext',
      amount: ['Umsatz in EUR', 'Umsatz (EUR)'],
    },
    quirks: { decimalSeparator: ',', dateFormat: 'DD.MM.YYYY', amountSignConvention: 'negative' }
  },
  // Placeholders for others to be added quickly
];


