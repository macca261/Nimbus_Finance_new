import { useMemo, useState } from 'react';
import { useDashboardData, type DashboardSummary } from './useDashboardData';

export type DashboardUiState = 'empty' | 'early' | 'pro';

export type PeriodOptionId = '7d' | '30d' | '90d' | 'ytd' | 'custom';

export interface PeriodOption {
  id: PeriodOptionId;
  label: string;
}

export interface AccountOption {
  id: string;
  label: string;
  type?: 'bank' | 'paypal' | 'other';
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { id: '7d', label: 'Letzte 7 Tage' },
  { id: '30d', label: 'Letzte 30 Tage' },
  { id: '90d', label: 'Letzte 90 Tage' },
  { id: 'ytd', label: 'Jahr bisher' },
  { id: 'custom', label: 'Benutzerdefiniert' },
];

function deriveAccounts(summary: DashboardSummary | null | undefined): AccountOption[] {
  const list = summary?.accounts ?? [];
  if (!Array.isArray(list) || !list.length) {
    return [{ id: 'all', label: 'Alle Konten' }];
  }
  const items: AccountOption[] = [{ id: 'all', label: 'Alle Konten' }];
  for (const account of list) {
    items.push({
      id: account.id ?? account.accountId ?? account.label ?? account.name ?? 'unknown',
      label: account.label ?? account.name ?? account.id ?? 'Unbekanntes Konto',
      type: account.type as AccountOption['type'],
    });
  }
  return items;
}

export function useDashboardState() {
  const dashboard = useDashboardData();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOptionId>('30d');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');

  const accounts = useMemo(() => deriveAccounts(dashboard.summary), [dashboard.summary]);
  const accountsCount = Math.max(
    0,
    accounts.length - (accounts[0]?.id === 'all' ? 1 : 0),
  );
  const paypalWalletsCount =
    dashboard.summary?.accounts?.filter?.(account => account.type === 'paypal').length ?? 0;

  const hasAnyTransactions =
    (dashboard.summary?.balanceOverTime?.length ?? 0) > 0 ||
    (dashboard.recent?.length ?? 0) > 0 ||
    (dashboard.summary?.transactionCount ?? 0) > 0;

  const importsCount =
    dashboard.summary?.importHistory?.length ??
    (dashboard.summary?.lastImport ? 1 : 0);

  const uiState: DashboardUiState = !hasAnyTransactions
    ? 'empty'
    : importsCount < 3
    ? 'early'
    : 'pro';

  const hasParserWarnings = (dashboard.summary?.parserWarnings?.length ?? 0) > 0;

  const selectedPeriodOption = PERIOD_OPTIONS.find(option => option.id === selectedPeriod) ?? PERIOD_OPTIONS[1];

  return {
    ...dashboard,
    uiState,
    hasAnyTransactions,
    importsCount,
    hasParserWarnings,
    warningsCount: dashboard.summary?.parserWarnings?.length ?? 0,
    accounts,
    accountsCount,
    paypalWalletsCount,
    selectedAccount,
    setSelectedAccount,
    selectedPeriod,
    selectedPeriodOption,
    setSelectedPeriod,
    periodOptions: PERIOD_OPTIONS,
  };
}


