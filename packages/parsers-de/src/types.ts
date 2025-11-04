export type BankId =
  | 'deutsche-bank'
  | 'commerzbank'
  | 'ing'
  | 'postbank';

export interface ParsedTransaction {
  bank: BankId;
  bookingDate: string;        // YYYY-MM-DD
  valueDate?: string;
  amount: string;             // decimal string with dot
  currency: string;           // 'EUR'
  description: string;
  counterparty?: string;
  iban?: string;
  bic?: string;
  raw?: Record<string, string>;
}

