export type Plan = 'free' | 'pro_lite' | 'pro_plus';

export type CanonicalTransaction = {
  bookingDate: string; // ISO date (YYYY-MM-DD)
  valueDate?: string; // ISO date (YYYY-MM-DD)
  amount: number;
  currency: string;
  counterpartName?: string;
  counterpartIban?: string;
  counterpartBic?: string;
  purpose?: string;
  txType?: string;
  rawCode?: string;
};

export type ProviderNormalizedTx = {
  bookingDate: string;
  valueDate?: string;
  amount: string; // raw from CSV, e.g., "1.234,56"
  currency?: string;
  counterpartName?: string;
  counterpartIban?: string;
  counterpartBic?: string;
  purpose?: string;
  txType?: string;
  rawCode?: string;
};


