/**
 * Rules module - Type definitions and re-exports.
 * 
 * This module now serves as a type-only module and re-exports runtime functions
 * from rulesRuntime.ts to maintain backward compatibility.
 * 
 * CRITICAL: All runtime logic has been moved to rulesRuntime.ts to break circular dependencies.
 * This module should NOT contain any runtime code that could cause module loading issues.
 */

import type { CategoryRule, CategoryRuleConditions, MerchantPattern } from './types';
import type { CategoryId } from './categoryRegistry';

// Re-export runtime functions and types from rulesRuntime to maintain backward compatibility
// This allows existing code that imports from './rules' to continue working
export {
  applyRules,
  applyRulesForRow,
  applyBasicRules,
  SYSTEM_RULES,
  SYSTEM_RULES_CONFIG,
  type ApplyRulesResult,
  type RuleHit,
  type RuleHitLegacy,
  type Rule,
} from './rulesRuntime';

// Re-export types from types.ts (these are used by other modules)
export type { CategoryRule, CategoryRuleConditions, MerchantPattern } from './types';

// Legacy exports for backward compatibility
export type NormalizationRule = CategoryRule;

export type RuleSet = NormalizationRule[];

export interface ApplyRulesInput {
  normalizedText: string;
  normalizedDescription: string;
  merchant?: string;
  bookingDate: string;
  amountCents: number;
  currency: string;
  direction: 'in' | 'out';
  raw: Record<string, unknown>;
}

export interface ApplyRulesOutput {
  normalizedText: string;
  normalizedDescription: string;
  merchant?: string;
  categoryId?: string | null;
  categorySource?: 'rule' | 'ml' | 'user' | 'ai' | 'unknown' | 'fallback';
  debug?: unknown[];
}

// Legacy function for backward compatibility with old applyRules signature
export function applyRulesLegacy(
  input: ApplyRulesInput,
  ruleSet: RuleSet = [],
  opts?: { dryRun?: boolean }
): ApplyRulesOutput {
  // Import at function level to avoid circular dependency issues
  const { applyRulesForRow } = require('./rulesRuntime');
  
  // Convert ApplyRulesInput to ParsedRow-like structure
  const row = {
    bookingDate: input.bookingDate,
    amountCents: input.amountCents,
    currency: input.currency,
    direction: input.direction,
    accountId: 'unknown',
    rawText: input.normalizedDescription,
    normalizedText: input.normalizedText,
    raw: input.raw,
    counterparty: input.merchant,
    valutaDate: null,
    accountIban: null,
    counterpartyIban: null,
    mcc: null,
    reference: null,
  };
  
  const result = applyRulesForRow(row, { systemRules: ruleSet });
  
  const output: ApplyRulesOutput = {
    normalizedText: input.normalizedText,
    normalizedDescription: input.normalizedDescription,
    merchant: input.merchant,
    categoryId: result.categoryId,
    categorySource: result.categorySource === 'rule' ? 'rule' : 'unknown',
  };
  
  if (opts?.dryRun) {
    output.debug = [{ step: 'dryRun', input, ruleSetLength: ruleSet.length }];
  }
  
  return output;
}
