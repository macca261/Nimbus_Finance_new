import type { ParsedRow } from '../parser/types';
import type { CategoryId } from '../types/category';
import type { Transaction } from '../types/core';
import type { NimbusCategoryId } from './taxonomy';

export type CategorySource = 'rule' | 'ml' | 'user' | 'fallback' | 'ai' | 'unknown' | 'system' | 'merchant-db-fuzzy' | 'heuristic:recurring' | 'heuristic:salary' | 'heuristic:rent' | 'heuristic:housing' | 'heuristic:uber-subscription';

export interface CategorizedTransaction extends Omit<ParsedRow, 'categorySystem' | 'category' | 'categorySource'> {
  category?: NimbusCategoryId;
  categoryConfidence?: number;
  categorySource?: CategorySource; // Our extended CategorySource type (includes 'system')
  categorySystem?: 'nimbus-v1' | string;
  merchant?: string;
  normalizedDescription?: string;
  categoryHint?: string | null;
  categoryExplanation?: {
    ruleId: string;
    merchantName?: string;
    matchedText?: string;
  };
}

/**
 * Conditions for matching a category rule.
 * Mirrors the whenJson structure from Prisma CategoryRule model.
 */
export interface CategoryRuleConditions {
  direction?: 'in' | 'out';
  contains?: string[];
  regex?: string;
  ibanEquals?: string;
  mccIn?: string[];
  merchantEquals?: string;
  minAmountAbs?: number;
  maxAmountAbs?: number;
}

/**
 * Category rule used by the engine and rules file.
 * This type represents both system and user rules.
 */
export interface CategoryRule {
  id: string;
  source: 'system' | 'user';
  enabled: boolean;
  score: number;
  setCategory: string;
  when: CategoryRuleConditions;
}

/**
 * Merchant pattern for merchant normalization.
 */
export interface MerchantPattern {
  id: string;
  source: 'system' | 'user';
  pattern: string;
  normalized: string;
  category?: string;
  score: number;
  exact?: boolean;
}

export interface CategorizeInput {
  text: string;
  amount: number;
  iban?: string | null;
  counterpart?: string | null;
  memo?: string | null;
  payee?: string | null;
  source?: Transaction['source'];
  amountCents?: number;
  transaction?: Transaction;
  overrideMatch?: { ruleId: string; categoryId: CategoryId };
}

export interface CategorizeResult {
  category: CategoryId;
  confidence: number;
  source: 'rule' | 'heuristic' | 'fallback';
  ruleId?: string;
  explanation?: string;
}
