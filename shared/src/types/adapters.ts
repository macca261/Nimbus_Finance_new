export type AdapterMatch = {
  anyHeader?: string[];
  allHeaders?: string[];
  filenameIncludes?: string[];
};

export type LocaleNumberRule = {
  col: string;
  locale?: 'de-DE' | 'en-US' | string;
};

export type ConcatRule = {
  concat: string[];
  sep?: string;
};

export type LookupRule = {
  from: string;
  lookup: Record<string, string>;
};

export type CreditDebitRule = {
  creditCol: string;
  debitCol: string;
  locale?: 'de-DE' | 'en-US' | string;
};

export type AnyOfRule = {
  anyOf: (string | LocaleNumberRule)[];
};

export type MapValueRule =
  | string
  | LocaleNumberRule
  | ConcatRule
  | LookupRule
  | CreditDebitRule
  | AnyOfRule
  | string[]; // fallbacks

export type AdapterMap = {
  bookingDate?: MapValueRule;
  valueDate?: MapValueRule;
  amount?: MapValueRule;
  currency?: MapValueRule;
  counterpartName?: MapValueRule;
  counterpartIban?: MapValueRule;
  counterpartBic?: MapValueRule;
  purpose?: MapValueRule;
  txType?: MapValueRule;
  rawCode?: MapValueRule;
};

export type Adapter = {
  id: string;
  match: AdapterMatch;
  map: AdapterMap;
  meta?: { bank?: string; country?: string; notes?: string };
};


