import type { CanonicalTransaction } from '@nimbus/shared/src/types/canonical';
import type { CategoryDecision } from '@nimbus/shared/src/categorisation';
import { buildCategorisationInput } from './input';
import { applyRules, type RuleContext } from './rules';
import { storeCategoryDecision } from './storeDecision';
import { getSharedCategories } from './categoriesProvider';

export async function categoriseWithRulesOnly(
  tx: CanonicalTransaction
): Promise<CategoryDecision | null> {
  const categories = getSharedCategories();
  const categoriesById = new Map(categories.map(category => [category.id, category]));

  const input = buildCategorisationInput(tx);
  const ctx: RuleContext = {
    ...input,
    categoriesById,
  };

  const result = applyRules(ctx);
  if (result.type === 'NO_MATCH') return null;

  return storeCategoryDecision({
    transactionId: tx.id,
    categoryId: result.categoryId,
    confidence: result.confidence ?? 0.95,
    source: 'RULE',
    modelVersion: null,
    ruleId: result.ruleId,
  });
}


