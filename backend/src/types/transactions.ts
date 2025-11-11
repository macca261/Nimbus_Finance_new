import type { CategoryId } from './category';
import type { Source } from './core';

export type Direction = 'in' | 'out';

export interface NormalizedTransaction {
  id: string;
  bookingDate: string;
  valutaDate?: string;
  amountCents: number;
  currency: string;
  direction: Direction;
  accountIban?: string;
  accountId?: string;
  counterparty?: string | null;
  counterpartyIban?: string | null;
  mcc?: string | null;
  rawText: string;
  bankProfile: string;
  category: CategoryId;
  categoryConfidence: number;
  categorySource: 'rule' | 'heuristic' | 'fallback' | 'feedback';
  categoryRuleId?: string;
  categoryExplanation?: string;
  raw?: Record<string, string>;
  source?: Source;
  sourceProfile?: string | null;
  payee?: string | null;
  memo?: string | null;
  externalId?: string | null;
  referenceId?: string | null;
  isTransfer?: boolean;
  isInternalTransfer?: boolean;
  transferLinkId?: string | null;
  confidence?: number | null;
  metadata?: Record<string, string | number | boolean | null>;
}


