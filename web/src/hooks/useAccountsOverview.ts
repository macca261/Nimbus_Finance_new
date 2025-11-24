import { useEffect, useMemo, useState } from 'react';
import type { ApiTransaction } from '../pages/Transactions';
import { detectRecurringCandidates } from '../lib/insights/recurring';
import type { NormalizedTransaction } from './useTransactionsData';
import { getCategoryLabel } from '../lib/categories';

export type AccountOverview = {
  id: string;
  name: string; // "DKB Giro", "ING Visa"
  bankName?: string;
  type: 'checking' | 'credit' | 'savings' | 'cash' | 'other';
  balance: number; // current balance in EUR
  currency: string; // usually 'EUR'
  last30dDelta: number; // balance change over last 30 days
  isPrimary?: boolean;
};

export type UpcomingPayment = {
  id: string;
  label: string; // e.g. "Netflix"
  date: string; // ISO date
  amount: number;
};

export type AccountsOverview = {
  accounts: AccountOverview[];
  totalBalance: number;
  totalDelta30d: number;
  lastUpdated: string; // ISO date
  upcomingPayments: UpcomingPayment[];
};

type TransactionResponse = {
  ok: boolean;
  total: number;
  transactions: ApiTransaction[];
};

type ApiAccount = {
  id: string;
  iban?: string | null;
  name?: string | null;
  role?: 'spending' | 'savings' | 'wallet' | 'other';
  type?: 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'CASH' | 'OTHER';
  isArchived?: boolean;
  createdAt?: string;
};

/**
 * Map account role to wallet type
 */
function mapRoleToType(role?: string | null): AccountOverview['type'] {
  switch (role) {
    case 'spending':
      return 'checking';
    case 'savings':
      return 'savings';
    case 'wallet':
      return 'cash';
    default:
      return 'other';
  }
}

/**
 * Extract bank name from account name or IBAN
 */
function extractBankName(name?: string | null, iban?: string | null): string | undefined {
  if (!name) return undefined;
  // Try to extract bank name from common patterns
  const parts = name.split(/\s+/);
  if (parts.length > 1) {
    return parts[0]; // "DKB Giro" -> "DKB"
  }
  return undefined;
}

/**
 * Extract last 4 digits from IBAN or account identifier
 */
function extractLast4(iban?: string | null, accountId?: string): string | undefined {
  if (iban) {
    const digits = iban.replace(/\D/g, '');
    return digits.slice(-4);
  }
  if (accountId) {
    const digits = accountId.replace(/\D/g, '');
    if (digits.length >= 4) {
      return digits.slice(-4);
    }
  }
  return undefined;
}

/**
 * Hook to fetch and compute accounts overview
 */
export function useAccountsOverview() {
  const [accounts, setAccounts] = useState<ApiAccount[]>([]);
  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch accounts (exclude archived by default)
  const loadAccounts = async () => {
    try {
      const res = await fetch('/api/accounts?includeArchived=false');
      if (!res.ok) throw new Error('Konten konnten nicht geladen werden.');
      const json = await res.json();
      const data = Array.isArray(json?.data) ? (json.data as ApiAccount[]) : [];
      // Filter out archived accounts as a safety measure
      const activeAccounts = data.filter(acc => !acc.isArchived);
      setAccounts(activeAccounts);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Konten konnten nicht geladen werden.');
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      await loadAccounts();
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch transactions for last 90 days
  useEffect(() => {
    let cancelled = false;
    const loadTransactions = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);
        startDate.setHours(0, 0, 0, 0);

        const params = new URLSearchParams();
        params.set('startDate', startDate.toISOString().split('T')[0]);
        params.set('endDate', endDate.toISOString().split('T')[0]);
        params.set('limit', '10000');

        const res = await fetch(`/api/transactions?${params.toString()}`);
        if (!res.ok) throw new Error('Transaktionen konnten nicht geladen werden.');
        const json = (await res.json()) as TransactionResponse;
        if (!cancelled) {
          setTransactions(
            (json.transactions ?? []).map(tx => ({
              ...tx,
              bookingDate: tx.bookingDate ?? tx.bookedAt ?? null,
            })),
          );
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Transaktionen konnten nicht geladen werden.');
          setTransactions([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    void loadTransactions();
    return () => {
      cancelled = true;
    };
  }, []);

  // Compute account overviews
  const data = useMemo<AccountsOverview | null>(() => {
    if (accounts.length === 0 && transactions.length === 0) return null;

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    // Group transactions by sourceProfile (account identifier)
    const byAccount = new Map<string, ApiTransaction[]>();
    for (const tx of transactions) {
      const accountId = tx.sourceProfile || 'default';
      const arr = byAccount.get(accountId) ?? [];
      arr.push(tx);
      byAccount.set(accountId, arr);
    }

    const accountOverviews: AccountOverview[] = [];

    // Process known accounts
    for (const account of accounts) {
      const accountTxs = byAccount.get(account.id) ?? [];
      const allAmounts = accountTxs.map(tx => tx.amount);
      const balance = allAmounts.reduce((sum, amt) => sum + amt, 0);

      const recentTxs = accountTxs.filter(tx => {
        if (!tx.bookingDate) return false;
        const txDate = new Date(tx.bookingDate);
        return txDate >= thirtyDaysAgo;
      });
      const last30dDelta = recentTxs.reduce((sum, tx) => sum + tx.amount, 0);

      const bankName = extractBankName(account.name, account.iban);
      const last4 = extractLast4(account.iban, account.id);

      accountOverviews.push({
        id: account.id,
        name: account.name || 'Unbenanntes Konto',
        bankName,
        type: mapRoleToType(account.role),
        balance,
        currency: 'EUR',
        last30dDelta,
        isPrimary: account.role === 'spending', // Mark spending accounts as primary
      });
    }

    // Process unknown accounts (transactions without a known account)
    const knownAccountIds = new Set(accounts.map(a => a.id));
    for (const [accountId, accountTxs] of byAccount.entries()) {
      if (knownAccountIds.has(accountId) || accountId === 'default') continue;

      const allAmounts = accountTxs.map(tx => tx.amount);
      const balance = allAmounts.reduce((sum, amt) => sum + amt, 0);

      const recentTxs = accountTxs.filter(tx => {
        if (!tx.bookingDate) return false;
        const txDate = new Date(tx.bookingDate);
        return txDate >= thirtyDaysAgo;
      });
      const last30dDelta = recentTxs.reduce((sum, tx) => sum + tx.amount, 0);

      // Try to infer name from transactions
      const firstTx = accountTxs[0];
      const inferredName = firstTx?.sourceProfile || `Konto ${accountId.slice(0, 8)}`;

      accountOverviews.push({
        id: accountId,
        name: inferredName,
        bankName: undefined,
        type: 'other',
        balance,
        currency: 'EUR',
        last30dDelta,
        isPrimary: false,
      });
    }

    // Sort: primary first, then by balance descending
    accountOverviews.sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return b.balance - a.balance;
    });

    // Calculate totals
    const totalBalance = accountOverviews.reduce((sum, acc) => sum + acc.balance, 0);
    const totalDelta30d = accountOverviews.reduce((sum, acc) => sum + acc.last30dDelta, 0);

    // Compute upcoming payments from recurring detection
    const normalizedTxs: NormalizedTransaction[] = transactions
      .filter(tx => !tx.isInternalTransfer && !tx.isPassThrough && !tx.isCashWithdrawal)
      .map(tx => {
        const merchant = tx.payee || tx.counterpart || tx.purpose || '—';
        const categoryId = tx.category ?? null;
        const categoryLabel = categoryId ? getCategoryLabel(categoryId) : 'Sonstiges';

        return {
          id: tx.id,
          bookingDate: tx.bookingDate,
          amount: tx.amount,
          categoryId,
          categoryLabel,
          merchant,
          counterparty: tx.counterpart || tx.payee || '—',
        };
      });

    const recurringCandidates = detectRecurringCandidates(normalizedTxs);
    const upcomingPayments: UpcomingPayment[] = recurringCandidates
      .map((candidate, idx) => {
        const lastDate = new Date(candidate.lastDate);
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + candidate.medianIntervalDays);

        // Only include if next date is within next 14 days
        const daysUntil = (nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (daysUntil < 0 || daysUntil > 14) return null;

        return {
          id: `recurring-${idx}`,
          label: candidate.merchant,
          date: nextDate.toISOString(),
          amount: candidate.typicalAmount,
        };
      })
      .filter((p): p is UpcomingPayment => p !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3); // Top 3

    return {
      accounts: accountOverviews,
      totalBalance,
      totalDelta30d,
      lastUpdated: now.toISOString(),
      upcomingPayments,
    };
  }, [accounts, transactions]);

  // Refetch function to reload accounts and transactions
  const refetch = async () => {
    // Reload accounts first
    await loadAccounts();
    
    // Also reload transactions to reflect any changes
    setIsLoading(true);
    setError(null);
    try {
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);
      startDate.setHours(0, 0, 0, 0);

      const params = new URLSearchParams();
      params.set('startDate', startDate.toISOString().split('T')[0]);
      params.set('endDate', endDate.toISOString().split('T')[0]);
      params.set('limit', '10000');

      const res = await fetch(`/api/transactions?${params.toString()}`);
      if (!res.ok) throw new Error('Transaktionen konnten nicht geladen werden.');
      const json = (await res.json()) as TransactionResponse;
      setTransactions(
        (json.transactions ?? []).map(tx => ({
          ...tx,
          bookingDate: tx.bookingDate ?? tx.bookedAt ?? null,
        })),
      );
    } catch (err: any) {
      console.error('[useAccountsOverview] Error reloading transactions:', err);
      setError(err?.message || 'Transaktionen konnten nicht geladen werden.');
      // Don't clear transactions on error - keep existing data
    } finally {
      setIsLoading(false);
    }
  };

  return {
    data,
    isLoading,
    error,
    refetch,
  };
}

