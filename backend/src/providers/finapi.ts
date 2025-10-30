import { BankProvider, ProviderAccountMeta, ProviderNormalizedTx } from './abstract';
import { encryptToken } from '../utils/crypto';

export class FinApiProvider implements BankProvider {
  readonly name = 'finapi' as const;

  async startOAuth(userId: string): Promise<{ url: string }> {
    // Stub sandbox flow
    const url = `https://sandbox.finapi.io/oauth/authorize?state=${encodeURIComponent(userId)}`;
    return { url };
  }

  async handleOAuthCallback(_query: Record<string, string>) {
    // Exchange code for tokens (stub)
    const access = encryptToken('finapi-access-token');
    const refresh = encryptToken('finapi-refresh-token');
    return {
      providerAccount: {
        provider: 'finapi',
        providerAccountId: 'finapi-demo-account',
        institutionName: 'finAPI Sandbox'
      } as ProviderAccountMeta,
      accessTokenEnc: access,
      refreshTokenEnc: refresh,
      expiresAt: new Date(Date.now() + 55 * 60 * 1000),
    };
  }

  async listAccounts(_accessTokenEnc: string): Promise<ProviderAccountMeta[]> {
    return [{ provider: 'finapi', providerAccountId: 'finapi-demo-account', institutionName: 'finAPI Sandbox', mask: '***1111' }];
  }

  async fetchTransactions(params: { accessTokenEnc: string; providerAccountId: string; since?: string; }): Promise<{ transactions: ProviderNormalizedTx[]; nextCursor?: string }> {
    // Stub data
    return {
      transactions: [
        { accountId: params.providerAccountId, bookingDate: '2025-10-01', amount: -12.99, currency: 'EUR', purpose: 'SPOTIFY', counterpartName: 'Spotify', txType: 'direct_debit' },
        { accountId: params.providerAccountId, bookingDate: '2025-10-03', amount: -9.99, currency: 'EUR', purpose: 'NETFLIX.COM', counterpartName: 'Netflix', txType: 'card_payment' },
      ],
      nextCursor: undefined,
    };
  }
}


