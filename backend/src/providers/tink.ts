import { BankProvider, ProviderAccountMeta, ProviderNormalizedTx } from './abstract';
import { encryptToken } from '../utils/crypto';

export class TinkProvider implements BankProvider {
  readonly name = 'tink' as const;

  async startOAuth(userId: string): Promise<{ url: string }> {
    const url = `https://link.tink.com/1.0/authorize?state=${encodeURIComponent(userId)}`;
    return { url };
  }

  async handleOAuthCallback(_query: Record<string, string>) {
    const access = encryptToken('tink-access-token');
    const refresh = encryptToken('tink-refresh-token');
    return {
      providerAccount: {
        provider: 'tink',
        providerAccountId: 'tink-demo-account',
        institutionName: 'Tink Sandbox'
      } as ProviderAccountMeta,
      accessTokenEnc: access,
      refreshTokenEnc: refresh,
      expiresAt: new Date(Date.now() + 55 * 60 * 1000),
    };
  }

  async listAccounts(_accessTokenEnc: string): Promise<ProviderAccountMeta[]> {
    return [{ provider: 'tink', providerAccountId: 'tink-demo-account', institutionName: 'Tink Sandbox', mask: '***2222' }];
  }

  async fetchTransactions(params: { accessTokenEnc: string; providerAccountId: string; since?: string; }): Promise<{ transactions: ProviderNormalizedTx[]; nextCursor?: string }> {
    return {
      transactions: [
        { accountId: params.providerAccountId, bookingDate: '2025-10-05', amount: -3.2, currency: 'EUR', purpose: 'KVB TICKET', counterpartName: 'KVB', txType: 'card_payment' },
        { accountId: params.providerAccountId, bookingDate: '2025-10-07', amount: -29.0, currency: 'EUR', purpose: 'DEUTSCHE BAHN', counterpartName: 'DB BAHN', txType: 'card_payment' },
      ],
      nextCursor: undefined,
    };
  }
}


