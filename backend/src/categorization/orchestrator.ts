import type { ParsedRow } from '../parser/types';
import { SYSTEM_RULES } from './rules';
import { SYSTEM_MERCHANT_PATTERNS } from './merchantPatterns';
import { categorizeWithRules } from './engine';
import type {
  CategorizedTransaction,
  CategoryRule,
} from './types';

export interface CategorizationOptions {
  userRules?: CategoryRule[];
  enableMl?: boolean;
  enableAiFallback?: boolean;
}

export async function categorizeTransaction(
  row: ParsedRow,
  options: CategorizationOptions = {},
): Promise<CategorizedTransaction> {
  const base = categorizeWithRules(row, {
    systemRules: SYSTEM_RULES,
    merchantPatterns: SYSTEM_MERCHANT_PATTERNS,
    userRules: options.userRules ?? [],
  });

  // Future ML/AI hooks go here.
  if (options.enableMl && (!base.category || base.categoryConfidence! < 0.5)) {
    // Placeholder for ML integration.
  }

  if (options.enableAiFallback && base.categoryConfidence! < 0.5) {
    // Placeholder for AI (LLM) fallback integration.
  }

  return base;
}

export async function categorizeTransactions(
  rows: ParsedRow[],
  options: CategorizationOptions = {},
): Promise<CategorizedTransaction[]> {
  return Promise.all(rows.map(row => categorizeTransaction(row, options)));
}


