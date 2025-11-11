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
  rawText: string;
  normalizedText?: string;
  categorySystem?: 'nimbus-v1';
  category?: string;
  categoryConfidence?: number;
  categorySource?: 'rule' | 'ml' | 'user' | 'fallback' | 'ai' | 'unknown';
  raw: Record<string, unknown>;
}

export interface ParseCandidate {
  profileId: string;
  confidence: number;
}

export interface ParseResult {
  profileId: string;
  confidence: number;
  rows: ParsedRow[];
  warnings: string[];
  candidates: ParseCandidate[];
  openingBalance?: number;
  closingBalance?: number;
}

