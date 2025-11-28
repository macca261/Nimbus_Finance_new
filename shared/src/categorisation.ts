export type CategorySource = 'RULE' | 'MODEL' | 'LLM' | 'USER';

export interface CategoryDecision {
  id: string;
  transactionId: string;
  categoryId: string;
  confidence: number;
  source: CategorySource;
  modelVersion?: string | null;
  ruleId?: string | null;
  createdAt: string;
}


