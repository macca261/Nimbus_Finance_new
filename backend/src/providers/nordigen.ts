import { BankProvider, ProviderAccountMeta, ProviderNormalizedTx } from './abstract';

export class NordigenProvider implements BankProvider {
  readonly name = 'nordigen' as const;

  async startOAuth(userId: string): Promise<{ url: string }> {
    return { url: `https://nordigen.com/oauth/authorize?state=${encodeURIComponent(userId)}` };
  }

  async handleOAuthCallback(_query: Record<string, string>) {
    return {
      providerAccount: {
        provider: 'nordigen',
        providerAccountId: 'demo-account',
        institutionName: 'Demo Bank'
      } as ProviderAccountMeta,
      accessTokenEnc: 'demo-token-encrypted',
      refreshTokenEnc: 'demo-refresh-token-encrypted'
    };
  }

  async listAccounts(_accessTokenEnc: string): Promise<ProviderAccountMeta[]> {
    return [{
      provider: 'nordigen',
      providerAccountId: 'demo-account-1',
      institutionName: 'Comdirect Bank',
      mask: '***1234'
    }];
  }

  async fetchTransactions(params: {
    accessTokenEnc: string;
    providerAccountId: string;
    since?: string;
  }): Promise<{ transactions: ProviderNormalizedTx[]; nextCursor?: string }> {
    return {
      transactions: [
        {
          accountId: params.providerAccountId,
          bookingDate: '2025-10-27',
          amount: -66.99,
          currency: 'EUR',
          purpose: 'Lidl sagt Danke, Koeln-Muenger DE',
          counterpartName: 'Lidl',
          txType: 'card_payment'
        },
        {
          accountId: params.providerAccountId,
          bookingDate: '2025-10-27',
          amount: -17.57,
          currency: 'EUR',
          purpose: 'CURSOR, AI POWERED IDE, CURSOR.COM US',
          counterpartName: 'Cursor Software',
          txType: 'card_payment'
        }
      ],
      nextCursor: 'next-page-cursor'
    };
  }
}


