export type BankId = 'comdirect' | 'sparkasse' | 'deutsche-bank';

export interface ParsedTransaction {
  bank: BankId;
  bookingDate: string;      // YYYY-MM-DD
  valueDate?: string;       // YYYY-MM-DD
  amount: string;           // decimal w/ dot (e.g. "-12.34")
  currency: 'EUR';
  description: string;
  counterparty?: string;
  iban?: string;
  bic?: string;
  raw?: Record<string,string>;
}

