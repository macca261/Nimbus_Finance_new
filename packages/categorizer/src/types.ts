import type { ParsedTransaction } from '@nimbus/parsers-de/dist/types.js';

export type Category =
  | 'Income'
  | 'Groceries'
  | 'Dining'
  | 'Transport'
  | 'Housing'
  | 'Utilities'
  | 'Health'
  | 'Subscriptions'
  | 'Shopping'
  | 'Education'
  | 'Entertainment'
  | 'Fees'
  | 'Insurance'
  | 'Taxes'
  | 'Travel'
  | 'Gifts'
  | 'Savings'
  | 'Transfers'
  | 'Other';

export interface CategorizedTransaction extends ParsedTransaction {
  category: Category;
  confidence: number;
  source: 'rule' | 'ml';
  rationale?: string;
}

