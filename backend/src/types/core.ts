import type { CategoryId } from './category';

export type Source = 'csv_bank' | 'csv_paypal' | 'api_tink' | 'manual';

export interface Transaction {
  id: string;
  source: Source;
  sourceProfile: string | null;
  accountId: string;
  bookingDate: string;
  valueDate?: string;
  amountCents: number;
  currency: string;
  payee: string | null;
  counterparty?: string | null;
  memo: string | null;
  categoryId?: CategoryId | null;
  confidence?: number;
  externalId?: string | null;
  referenceId?: string | null;
  isTransfer?: boolean;
  isTransferLikeHint?: boolean;
  transferLinkId?: string | null;
  raw?: Record<string, unknown>;
  isRefund?: boolean;
  isRefunded?: boolean;
  refundGroupId?: string | null;
  isInternalTransfer?: boolean;
  internalTransferDirection?: 'out' | 'in' | null;
  internalTransferKind?: 'savings' | 'wallet' | 'other' | null;
  internalTransferGroupId?: string | null;
  isReimbursement?: boolean;
  reimbursementRole?: 'payer' | 'receiver' | null;
  reimbursementGroupId?: string | null;
  reimbursementShareRatio?: number | null;
  bankReferenceId?: string | null;
  categorizationReasonCode?: string;
  categorizationReasonText?: string;
  isPassThrough?: boolean;
  passThroughGroupId?: string | null;
}

export interface TransferLink {
  id: string;
  fromTxId: string;
  toTxId: string;
  kind: 'internal_transfer' | 'paypal_payout' | 'paypal_topup' | 'refund';
  score: number;
  reasons: string[];
  createdAt: string;
}

export type AccountRole = 'spending' | 'savings' | 'wallet';

export interface Account {
  id: string;
  iban?: string | null;
  name?: string | null;
  role?: AccountRole;
  createdAt?: string;
}

export interface UserOverrideRule {
  id: string;
  patternType: 'payee' | 'memo' | 'iban' | 'mcc' | 'fingerprint';
  pattern: string;
  categoryId: CategoryId;
  applyToPast: boolean;
  createdAt: string;
}
