import type { ParsedRow } from '../parser/types';
import { categorizeWithRules } from './engine';
import type { CategorizedTransaction, CategorizeInput, CategorizeResult } from './types';
// Import from rulesRuntime to avoid circular dependencies
import { SYSTEM_RULES, applyRules, applyRulesForRow, applyBasicRules } from './rulesRuntime';
import { SYSTEM_MERCHANT_PATTERNS } from './merchantPatterns';
import type { CategoryId } from '../types/category';
import { isValidCategoryId as isValidNimbusCategoryId } from './categoryRegistry';
import type { CategorizationOptions } from './orchestrator';
import { categorizePaypal } from '../paypal/rules';
import fs from 'node:fs';
import path from 'node:path';
export type { CategorizeInput, CategorizeResult } from './types';
export type { CategorizationOptions } from './orchestrator';
export { categorizeTransaction as categorizeTransactionAsync, categorizeTransactions } from './orchestrator';
// Re-export from rulesRuntime (not rules.ts) to maintain API compatibility
export { applyRules, applyRulesForRow, applyBasicRules, SYSTEM_RULES } from './rulesRuntime';
export type { NormalizationRule, RuleSet, ApplyRulesInput, ApplyRulesOutput } from './rules';

export function categorizeTransaction(
  input: ParsedRow,
  options: CategorizationOptions = {},
): CategorizedTransaction {
  return categorizeWithRules(input, {
    systemRules: SYSTEM_RULES,
    merchantPatterns: SYSTEM_MERCHANT_PATTERNS,
    userRules: options.userRules ?? [],
  });
}

export function categorizeBatch(
  rows: ParsedRow[],
  options: CategorizationOptions = {},
): CategorizedTransaction[] {
  return rows.map(row => {
    try {
      return categorizeTransaction(row, options);
    } catch (err) {
      // fallback to raw row w/ unknown category
      return {
        ...row,
        normalizedText: row.rawText ?? '',
        normalizedDescription: row.rawText ?? '',
        merchant: row.counterparty ?? undefined,
        categorySource: 'unknown',
        categorySystem: 'nimbus-v1',
        category: 'other',
        categoryConfidence: 0.1,
      };
    }
  });
}

const CATEGORY_MAPPING: Record<string, CategoryId> = {
  income: 'income_other',
  'income:salary': 'income_salary',
  'income:freelance': 'income_other',
  'income:refunds': 'income_other',

  housing: 'utilities',
  'housing:rent': 'rent',
  'housing:utilities': 'utilities',
  'housing:mortgage': 'rent',

  groceries: 'groceries',
  'groceries:supermarket': 'groceries',

  dining: 'dining_out',
  'dining:delivery': 'delivery',
  'dining:cafe': 'dining_out',
  'dining:bakery': 'dining_out',

  transport: 'transport',
  'transport:public': 'transport',
  'transport:fuel': 'car',
  'transport:rideshare': 'transport',
  'transport:mobility': 'transport',

  subscriptions: 'subscriptions',
  'subscriptions:streaming': 'subscriptions',
  'subscriptions:software': 'subscriptions',
  'subscriptions:telecom': 'telecom_internet',
  'subscriptions:transport': 'subscriptions',

  shopping: 'shopping',
  'shopping:electronics': 'shopping',
  'shopping:home': 'shopping',
  'shopping:home_improvement': 'shopping',
  'shopping:online': 'shopping',

  health: 'health',
  'health:medical': 'health',
  'health:pharmacy': 'health',
  insurance: 'insurance',
  'insurance:travel': 'insurance',
  education: 'education',

  fees: 'fees_charges',
  'fees:bank': 'fees_charges',
  'fees:service': 'fees_charges',

  taxes: 'taxes',

  savings: 'savings_investments',
  'savings:brokerage': 'savings_investments',
  'savings:pension': 'savings_investments',

  internal: 'transfer_internal',
  'internal:own-account': 'transfer_internal',
  'internal:savings': 'transfer_internal',
  'internal:wallet': 'transfer_internal',
  'internal:transfer_savings': 'transfer_internal',
  'internal:transfer_wallet': 'transfer_internal',
  'internal:transfer_other': 'transfer_internal',

  travel: 'other',
  'travel:holiday': 'other',

  charity: 'other',

  other: 'other',
  uncategorized: 'other',
};

/**
 * Startup validation: Check that all categories used in rules are properly mapped.
 * This prevents silent "Sonstiges" failures when new categories are added.
 */
function validateCategoryCoverage(): void {
  if (process.env.CATEGORIZATION_COVERAGE_VALIDATED === 'true') {
    return; // Only run once per process
  }

  const usedCategories = new Set<string>();

  // Collect categories from SYSTEM_RULES
  for (const rule of SYSTEM_RULES) {
    if (rule.setCategory) {
      usedCategories.add(rule.setCategory);
    }
  }

  // Collect categories from SYSTEM_RULES_CONFIG (from rulesRuntime)
  // Import SYSTEM_RULES_CONFIG dynamically to avoid circular dependency issues
  try {
    const rulesRuntime = require('./rulesRuntime');
    if (rulesRuntime.SYSTEM_RULES_CONFIG) {
      for (const rule of rulesRuntime.SYSTEM_RULES_CONFIG) {
        if (rule.category) {
          usedCategories.add(rule.category);
        }
      }
    }
  } catch (err) {
    // Silently continue if rulesRuntime can't be loaded
  }

  // Collect categories from legacyRules.json
  try {
    let legacyRulesPath: string | null = null;
    const dirnamePath = path.join(__dirname, 'legacyRules.json');
    if (fs.existsSync(dirnamePath)) {
      legacyRulesPath = dirnamePath;
    } else {
      const cwdPath = path.join(process.cwd(), 'src', 'categorization', 'legacyRules.json');
      if (fs.existsSync(cwdPath)) {
        legacyRulesPath = cwdPath;
      }
    }

    if (legacyRulesPath) {
      const legacyRulesContent = fs.readFileSync(legacyRulesPath, 'utf-8');
      const legacyRules = JSON.parse(legacyRulesContent) as Array<{ category: string }>;
      for (const rule of legacyRules) {
        if (rule.category) {
          usedCategories.add(rule.category);
        }
      }
    }
  } catch (err) {
    // Silently continue if legacyRules.json can't be loaded
  }

  // Check each category
  const legacyCategoryIds: CategoryId[] = [
    'income_salary', 'income_other',
    'rent', 'utilities',
    'groceries',
    'dining_out', 'delivery',
    'transport', 'car',
    'shopping',
    'subscriptions', 'telecom_internet',
    'insurance',
    'fees_charges',
    'cash_withdrawal',
    'transfer_internal', 'transfer_external',
    'p2p_income', 'p2p_in', 'p2p_out',
    'paypal_fee', 'paypal_payout', 'paypal_refund', 'paypal_hold',
    'currency_conversion_diff',
    'savings_investments',
    'taxes',
    'health',
    'education',
    'other_review',
    'other',
  ];

  const unmappedCategories: string[] = [];
  for (const category of usedCategories) {
    // Check if it's in CATEGORY_MAPPING
    if (CATEGORY_MAPPING[category]) {
      continue; // Mapped, OK
    }
    // Check if it's a valid legacy CategoryId
    if (legacyCategoryIds.includes(category as CategoryId)) {
      continue; // Valid legacy ID, OK (but will warn at runtime)
    }
    // Not mapped and not valid
    unmappedCategories.push(category);
  }

  if (unmappedCategories.length > 0) {
    const errorMessage = `[categorization] FATAL: Unmapped categories found in rules:\n${unmappedCategories.map(c => `  - "${c}"`).join('\n')}\nAdd them to CATEGORY_MAPPING or make them valid CategoryId values.`;
    
    if (process.env.NODE_ENV !== 'production') {
      // In development, fail fast
      throw new Error(errorMessage);
    } else {
      // In production, log error but don't crash
      console.error(errorMessage);
    }
  }

  process.env.CATEGORIZATION_COVERAGE_VALIDATED = 'true';
}

// Run validation on module load
validateCategoryCoverage();

/**
 * Map a Nimbus category ID (from categoryRegistry.ts) to a legacy CategoryId (from types/category.ts).
 * 
 * This function is stricter than before:
 * 1. If explicit mapping exists, use it
 * 2. If category itself is a valid legacy CategoryId, accept it as-is (with warning)
 * 3. Otherwise, log error and fall back to 'other'
 */
export function mapNimbusCategoryToLegacy(category?: string | null): CategoryId {
  if (!category) return 'other';

  // 1. If explicit mapping exists, use it
  const mapped = CATEGORY_MAPPING[category];
  if (mapped) return mapped;

  // 2. If category itself is a valid legacy CategoryId, accept it as-is
  // Check against the legacy CategoryId type from types/category.ts
  const legacyCategoryIds: CategoryId[] = [
    'income_salary', 'income_other',
    'rent', 'utilities',
    'groceries',
    'dining_out', 'delivery',
    'transport', 'car',
    'shopping',
    'subscriptions', 'telecom_internet',
    'insurance',
    'fees_charges',
    'cash_withdrawal',
    'transfer_internal', 'transfer_external',
    'p2p_income', 'p2p_in', 'p2p_out',
    'paypal_fee', 'paypal_payout', 'paypal_refund', 'paypal_hold',
    'currency_conversion_diff',
    'savings_investments',
    'taxes',
    'health',
    'education',
    'other_review',
    'other',
  ];
  
  if (legacyCategoryIds.includes(category as CategoryId)) {
    console.warn(
      '[categorization] category used directly without mapping (consider adding to CATEGORY_MAPPING):',
      category,
    );
    return category as CategoryId;
  }

  // 3. Otherwise, log loudly and fall back to 'other'
  console.error(
    '[categorization] UNMAPPED CATEGORY:',
    category,
    '→ falling back to "other". Add it to CATEGORY_MAPPING!',
  );
  return 'other';
}

function toCategorizeResult(row: ParsedRow): CategorizeResult {
  const category = mapNimbusCategoryToLegacy(row.category);
  const confidence =
    typeof row.categoryConfidence === 'number'
      ? Math.max(0, Math.min(1, row.categoryConfidence))
      : 0;
  // Map categorySource to CategorizeResult source
  // merchant-db-fuzzy is treated as 'rule' since it's a rule-based match
  const categorySource = row.categorySource as string | undefined;
  const source =
    categorySource === 'rule' || categorySource === 'user' || categorySource === 'merchant-db-fuzzy'
      ? 'rule'
      : categorySource === 'ml' || categorySource === 'ai'
        ? 'heuristic'
        : 'fallback';

  // Extract ruleId from categoryExplanation if available
  const ruleId = (row as any).categoryExplanation?.ruleId ?? 
                 (row as any).categoryRuleId ?? 
                 undefined;

  return {
    category,
    confidence,
    source,
    ruleId,
  };
}

export function categorize(input: CategorizeInput): CategorizeResult {
  if (input.overrideMatch) {
    return {
      category: input.overrideMatch.categoryId,
      confidence: 1,
      source: 'rule',
      ruleId: input.overrideMatch.ruleId,
    };
  }

  const source = input.source ?? input.transaction?.source;

  if (source === 'csv_paypal' && input.transaction) {
    const paypalCategory = categorizePaypal(input.transaction);
    if (paypalCategory) {
      const raw = input.transaction.raw as Record<string, unknown> | undefined;
      const reason =
        raw && typeof raw.paypalCategoryReason === 'string'
          ? (raw.paypalCategoryReason as string)
          : undefined;

      return {
        category: paypalCategory,
        confidence: 0.95,
        source: 'rule',
        ruleId: reason ?? 'paypal_rule',
        explanation: reason,
      };
    }
  }

  const amountCents = Math.round(input.amountCents ?? input.amount * 100);

  const direction: ParsedRow['direction'] = amountCents >= 0 ? 'in' : 'out';

  // Use separate fields instead of combined text to allow proper rule matching
  // The categorization engine needs rawText, counterparty, and reference separately
  const syntheticRow: ParsedRow = {
    bookingDate: input.transaction?.bookingDate ?? '1970-01-01',
    valutaDate: input.transaction?.valueDate ?? null,
    amountCents,
    currency: input.transaction?.currency ?? 'EUR',
    direction,
    accountId: input.transaction?.accountId ?? 'categorize:adhoc',
    accountIban: input.iban ?? null,
    counterparty: input.counterpart ?? input.transaction?.counterparty ?? null,
    counterpartyIban: null,
    mcc: null,
    // Use text (rawText) and reference separately - the engine combines them internally
    reference: input.transaction?.referenceId ?? null,
    rawText: input.text ?? input.memo ?? '',
    raw: {
      __source: 'categorize',
      memo: input.memo ?? null,
      payee: input.payee ?? null,
      source: input.source ?? null,
      transaction: input.transaction,
    },
    // Pass internal transfer flags from transaction to engine
    isInternalTransfer: (input.transaction as any)?.isInternalTransfer ?? false,
    internalTransferKind: (input.transaction as any)?.internalTransferKind ?? null,
    internalTransferDirection: (input.transaction as any)?.internalTransferDirection ?? null,
  };

  const categorized = categorizeTransaction(syntheticRow);
  // Convert CategorizedTransaction back to ParsedRow-like for toCategorizeResult
  const resultRow: ParsedRow = {
    ...syntheticRow,
    category: categorized.category ?? undefined,
    categoryConfidence: categorized.categoryConfidence,
    categorySource: (categorized.categorySource === 'system' ? 'rule' : categorized.categorySource) as any,
    categorySystem: categorized.categorySystem as 'nimbus-v1' | undefined,
  };
  return toCategorizeResult(resultRow);
}

