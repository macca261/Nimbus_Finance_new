export type Tx = {
  id: number | string;
  bookingDate?: string;
  valueDate?: string;
  amountCents?: number;
  currency?: string;
  purpose?: string;
  counterpartName?: string;
  accountIban?: string;
  category?: string;
  rawCode?: string;
};


