import type { ParsedRow } from '../parser/types';
import type { CategoryId } from '../types/category';
import type { Transaction } from '../types/core';
import type { NimbusCategoryId } from './taxonomy';

export type CategorySource = 'rule' | 'ml' | 'user' | 'ai' | 'unknown';

export interface CategorizedTransaction extends ParsedRow {
  category?: NimbusCategoryId;
  categoryConfidence?: number;
  categorySource?: CategorySource;
  merchant?: string;
  normalizedDescription?: string;
}

export interface CategoryRule {
  id: string;
  enabled: boolean;
  source: 'system' | 'user';
  score: number;
  when: {
    direction?: 'in' | 'out';
    contains?: string[];
    regex?: string;
    ibanEquals?: string;
    mccIn?: string[];
    merchantEquals?: string;
    minAmountAbs?: number;
    maxAmountAbs?: number;
  };
  setCategory: NimbusCategoryId;
}

export interface MerchantPattern {
  id: string;
  pattern: string;
  normalized: string;
  category?: NimbusCategoryId;
  mcc?: string;
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
