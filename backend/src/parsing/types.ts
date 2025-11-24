export type Direction = 'in' | 'out';

export interface ParsedRow {
  bookingDate: string;
  valutaDate?: string | null;
  amountCents: number;
  currency: string;
  direction: Direction;
  accountId: string;
  accountIban?: string | null;
  counterparty?: string | null;
  counterpartyIban?: string | null;
  mcc?: string | null;
  reference?: string | null;
  externalId?: string | null;
  rawText: string;
  normalizedText?: string;
  categorySystem?: 'nimbus-v1';
  category?: string;
  categoryConfidence?: number;
  categorySource?: 'rule' | 'ml' | 'user' | 'fallback' | 'ai' | 'unknown' | 'merchant-db-fuzzy' | 'heuristic:recurring' | 'heuristic:salary' | 'heuristic:rent' | 'heuristic:housing' | 'heuristic:uber-subscription';
  raw: Record<string, unknown>;
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
  isCashWithdrawal?: boolean;
}

export interface ParseCandidate {
  profileId: string;
  confidence: number;
}

export type DetectionCandidate = ParseCandidate;

export interface ParseResult {
  profileId: string;
  confidence: number;
  rows: ParsedRow[];
  warnings: string[];
  candidates: ParseCandidate[];
  openingBalance?: number;
  closingBalance?: number;
}

