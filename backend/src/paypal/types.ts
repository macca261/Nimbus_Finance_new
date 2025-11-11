export interface PaypalParseOptions {
  accountId: string;
  profile?: string;
}

export interface PaypalTransactionHints {
  paypalType?: string;
  paypalStatus?: string;
  paypalFlags?: string[];
}
