export interface ParserProfile {
  id: string;
  locale: 'de-DE';
  detection: {
    requiredHeaderTokens: string[];
    delimiter: ';' | ',';
    encodingHints?: Array<'utf8' | 'windows-1252'>;
  };
  columns: {
    bookingDate: string[];
    valutaDate?: string[];
    amount?: string[];
    credit?: string[];
    debit?: string[];
    currency?: string[];
    text?: string[];
    counterparty?: string[];
    iban?: string[];
    externalId?: string[];
    referenceId?: string[];
    balance?: string[];
  };
  formats: {
    date: Array<'dd.MM.yyyy' | 'yyyy-MM-dd'>;
    decimalComma: boolean;
    thousandSep?: '.' | ',' | ' ';
  };
  rules?: {
    skipIfZeroAmount?: boolean;
    pendingWords?: string[];
  };
  derive?: {
    accountIdTemplate?: string;
    preferAmountFromCreditDebit?: boolean;
  };
}


