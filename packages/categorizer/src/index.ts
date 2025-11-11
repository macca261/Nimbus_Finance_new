import type { ParsedTransaction } from '@nimbus/parsers-de/dist/types.js';
import type { CategorizedTransaction } from './types.js';
import { ruleCategorize } from './ruleEngine.js';

/**
 * Categorize a list of transactions
 * Uses rule engine first, falls back to ML (stubbed for now)
 */
export function categorize(list: ParsedTransaction[]): CategorizedTransaction[] {
  return list.map((tx) => {
    const text = `${tx.description || ''} ${tx.counterparty || ''}`.trim();
    const hit = ruleCategorize(text);

    if (hit) {
      return {
        ...tx,
        category: hit.category,
        confidence: 0.99,
        source: 'rule' as const,
        rationale: hit.reason,
      };
    }

    // TODO: ML fallback later
    // For now, return Other category with low confidence
    return {
      ...tx,
      category: 'Other' as const,
      confidence: 0.5,
      source: 'ml' as const,
      rationale: 'fallback',
    };
  });
}

export * from './types.js';

