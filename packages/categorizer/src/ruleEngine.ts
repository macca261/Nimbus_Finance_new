import { normalize } from './normalize.js';
import { merchants } from './rules/merchants.js';
import { patterns } from './rules/patterns.js';
import type { Category } from './types.js';

type RuleHit = {
  category: Category;
  reason: string;
};

/**
 * Rule-based categorization
 * Returns null if no rule matches
 */
export function ruleCategorize(text: string): RuleHit | null {
  const t = normalize(text);

  // 1. Check merchants first (exact matches)
  for (const [merchant, category] of Object.entries(merchants)) {
    if (t.includes(normalize(merchant))) {
      return {
        category: category as Category,
        reason: `merchant:${merchant}`,
      };
    }
  }

  // 2. Check patterns (regex matches)
  for (const { category, pattern, reason } of patterns) {
    if (pattern.test(text)) {
      return {
        category,
        reason: `pattern:${reason}`,
      };
    }
  }

  return null;
}
