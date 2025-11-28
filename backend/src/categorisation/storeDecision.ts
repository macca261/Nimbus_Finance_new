import type { CategoryDecision, CategorySource } from '@nimbus/shared/src/categorisation';
import type { Database } from '../db';
import { db, insertCategoryDecision } from '../db';

export function storeCategoryDecision(
  input: {
    transactionId: string;
    categoryId: string;
    confidence: number;
    source: CategorySource;
    modelVersion?: string | null;
    ruleId?: string | null;
  },
  conn: Database = db
): CategoryDecision {
  return insertCategoryDecision(conn, input);
}


