export interface ProviderNormalizedTx {
  accountId: string;
  bookingDate: string;
  valueDate?: string;
  amount: number;
  currency: string;
  purpose?: string;
  txType?: string;
  counterpartName?: string;
  counterpartIban?: string;
  counterpartBic?: string;
  mandateRef?: string;
  creditorId?: string;
  endToEndId?: string;
  rawCode?: string;
  mcc?: string;
  merchantId?: string;
  providerTxId?: string;
}

export interface ProviderAccountMeta {
  provider: 'vink' | 'finapi' | 'tink' | 'plaid' | 'nordigen';
  providerAccountId: string;
  institutionName?: string;
  mask?: string;
}

export interface BankProvider {
  readonly name: string;
  startOAuth(userId: string): Promise<{ url: string }>;
  handleOAuthCallback(query: Record<string, string>): Promise<{
    providerAccount: ProviderAccountMeta;
    accessTokenEnc: string;
    refreshTokenEnc?: string;
    expiresAt?: Date;
  }>;
  listAccounts(accessTokenEnc: string): Promise<ProviderAccountMeta[]>;
  fetchTransactions(params: {
    accessTokenEnc: string;
    providerAccountId: string;
    since?: string;
  }): Promise<{ transactions: ProviderNormalizedTx[]; nextCursor?: string }>;
}

export const computeStableTxId = (t: ProviderNormalizedTx & { accountId: string }) => {
  const base = [
    t.accountId,
    t.valueDate ?? t.bookingDate,
    t.amount.toFixed(2),
    (t.purpose ?? '').trim().toLowerCase(),
    t.endToEndId ?? t.mandateRef ?? t.rawCode ?? t.counterpartIban ?? t.counterpartName ?? ''
  ].join('|');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 'tx_' + h.toString(16);
};


