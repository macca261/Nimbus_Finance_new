import type { ParsedRow } from '../parser/types';
import { categorizeWithRules } from './engine';
import type { CategorizedTransaction, CategorizeInput, CategorizeResult } from './types';
import { SYSTEM_RULES } from './rules';
import { SYSTEM_MERCHANT_PATTERNS } from './merchantPatterns';
import type { CategoryId } from '../types/category';
import type { CategorizationOptions } from './orchestrator';
import { categorizePaypal } from '../paypal/rules';
export type { CategorizeInput, CategorizeResult } from './types';
export type { CategorizationOptions } from './orchestrator';
export { categorizeTransaction as categorizeTransactionAsync, categorizeTransactions } from './orchestrator';

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
  return rows.map(row => categorizeTransaction(row, options));
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

  dining: 'dining_out',
  'dining:delivery': 'delivery',
  'dining:cafe': 'dining_out',

  transport: 'transport',
  'transport:public': 'transport',
  'transport:fuel': 'car',
  'transport:rideshare': 'transport',
  'transport:mobility': 'transport',

  subscriptions: 'subscriptions',
  'subscriptions:streaming': 'subscriptions',
  'subscriptions:software': 'subscriptions',
  'subscriptions:telecom': 'telecom_internet',

  shopping: 'shopping',
  'shopping:electronics': 'shopping',
  'shopping:home': 'shopping',

  health: 'health',
  insurance: 'insurance',
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

  charity: 'other',

  other: 'other',
};

function mapNimbusCategoryToLegacy(category?: string | null): CategoryId {
  if (!category) return 'other';
  return CATEGORY_MAPPING[category] ?? 'other';
}

function toCategorizeResult(row: ParsedRow): CategorizeResult {
  const category = mapNimbusCategoryToLegacy(row.category);
  const confidence =
    typeof row.categoryConfidence === 'number'
      ? Math.max(0, Math.min(1, row.categoryConfidence))
      : 0;
  const source =
    row.categorySource === 'rule' || row.categorySource === 'user'
      ? 'rule'
      : row.categorySource === 'ml' || row.categorySource === 'ai'
        ? 'heuristic'
        : 'fallback';

  return {
    category,
    confidence,
    source,
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

  const syntheticRow: ParsedRow = {
    bookingDate: input.transaction?.bookingDate ?? '1970-01-01',
    valutaDate: input.transaction?.valutaDate ?? null,
    amountCents,
    currency: input.transaction?.currency ?? 'EUR',
    direction,
    accountId: input.transaction?.accountId ?? 'categorize:adhoc',
    accountIban: input.iban ?? input.transaction?.accountIban ?? null,
    counterparty: input.counterpart ?? input.transaction?.counterparty ?? null,
    counterpartyIban: input.transaction?.counterpartyIban ?? null,
    mcc: input.transaction?.mcc ?? null,
    reference: input.memo ?? input.transaction?.reference ?? null,
    rawText: input.text ?? '',
    raw: {
      __source: 'categorize',
      memo: input.memo ?? null,
      payee: input.payee ?? null,
      source: input.source ?? null,
      transaction: input.transaction,
    },
  };

  const categorized = categorizeTransaction(syntheticRow);
  return toCategorizeResult(categorized);
}

