import type { ParsedRow, ParseResult, ParseCandidate } from '../parsing/types';

export interface BankProfile {
  id: string;
  matches(headers: string[], sampleRows: string[][]): number;
  mapRow(record: Record<string, string>): ParsedRow | null;
}

export type DetectionCandidate = ParseCandidate;

export type { ParsedRow, ParseResult };
