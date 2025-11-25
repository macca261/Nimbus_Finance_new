/**
 * Import Strategy Interfaces
 * 
 * Defines the contract for bank-specific CSV parsers using the Strategy Pattern.
 * This enables auto-detection and streaming processing of large files.
 */

export interface NormalizedTransaction {
  date: string; // ISO 8601: YYYY-MM-DD
  amountCents: number; // Integer arithmetic (stored in cents)
  payee: string; // Cleaned merchant name
  description: string; // Raw Verwendungszweck/purpose
  currency: string;
  externalId: string | null; // Unique ID from bank if available
  hashId: string; // MD5 hash for deduplication: date+amount+payee+description
  category?: string | null; // Category assigned during import
  categoryConfidence?: number; // 0-1 confidence score
}

export interface ImportStrategy {
  name: string;
  /** Returns true if this strategy can handle the given headers */
  canParse(headers: string[]): boolean;
  /** Transforms a raw CSV row into our canonical format */
  mapRow(row: Record<string, string>): NormalizedTransaction | null;
  /** Specific CSV options (delimiter, encoding, start row) */
  csvOptions: {
    separator: string;
    encoding: 'utf-8' | 'latin1';
    skipLines: number;
  };
  /** Priority for matching (higher = more specific, checked first) */
  priority: number;
}

export interface ImportResult {
  transactions: NormalizedTransaction[];
  bank: string;
  totalRows: number;
  skippedRows: number;
  categorizedCount: number;
}

