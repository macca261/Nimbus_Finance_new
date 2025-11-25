import type { CategoryId } from './category';

export type Source = 'csv_bank' | 'csv_paypal' | 'api_tink' | 'manual';

/**
 * CategorizationTrace - Explanation of how a transaction category was chosen
 * 
 * This prepares Nimbus for explainable AI UX and future Pro tier features.
 * Stores method (RULE/ML/LLM), confidence, and metadata without storing full prompts
 * (GDPR/privacy requirement: only template IDs and base metrics).
 */
export interface CategorizationTrace {
  method: 'RULE' | 'ML' | 'LLM';
  confidence: number; // 0–100
  ruleMatch?: string; // e.g., 'rewe-supermarket'
  llmModel?: string; // e.g., 'gpt-4o-mini'
  llmPromptTemplateId?: string; // short ID for the template used, NOT full prompt text
}

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
  internalTransferKind?: 'savings' | 'wallet' | 'other' | 'payment_provider_funding' | null;
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
  isCashWithdrawal?: boolean;
  ignoreForReimbursement?: boolean;
  pairedTransactionId?: string | null; // Links funding leg to canonical expense (e.g., payment provider funding)
  categorizationTrace?: CategorizationTrace | null; // Explanation of how category was chosen
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

export interface ReimbursementAllocation {
  id: number;
  groupId: string;
  inflowTransactionId: string;
  expenseTransactionId: string;
  allocatedAmountCents: number;
}
