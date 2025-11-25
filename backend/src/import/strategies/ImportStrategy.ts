/**
 * Import Strategy Interface
 * 
 * Defines the contract for bank-specific CSV parsing strategies.
 * Each strategy knows how to detect its format and map rows to our canonical schema.
 */

export interface NormalizedTransaction {
  date: string; // YYYY-MM-DD
  amountCents: number; // Integer cents (negative for expenses, positive for income)
  payee: string; // Merchant/payee name
  description: string; // Transaction description/memo
  currency: string; // ISO currency code (default: EUR)
  externalId: string | null; // Bank's transaction ID if available, otherwise synthetic hash
}

export interface ImportStrategy {
  name: string;
  
  /**
   * Returns true if this strategy can handle the given header row
   * Should check for bank-specific column names
   */
  matches(headers: string): boolean;
  
  /**
   * Transforms a raw CSV row into our canonical format
   * Returns null if the row should be skipped (e.g., empty, invalid)
   */
  mapRow(row: any): NormalizedTransaction | null;
  
  /**
   * CSV parsing options specific to this strategy
   */
  csvOptions: {
    separator: string; // ';' or ','
    skipLines: number; // Number of preamble lines to skip
    encoding: 'utf-8' | 'latin1'; // Preferred encoding (can be overridden by detection)
  };
}

