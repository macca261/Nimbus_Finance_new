import type { Category } from '@nimbus/shared/src/categories';
import type { CategorisationInput } from './input';

export interface RuleContext extends CategorisationInput {
  categoriesById: Map<string, Category>;
}

export type RuleResult =
  | { type: 'MATCH'; categoryId: string; ruleId: string; confidence?: number }
  | { type: 'NO_MATCH' };

export type RuleFn = (ctx: RuleContext) => RuleResult;

export interface RuleDefinition {
  id: string;
  description: string;
  priority: number;
  fn: RuleFn;
}

const hasKeyword = (text: string, patterns: RegExp[]): boolean =>
  patterns.some(pattern => pattern.test(text));

const salaryPatterns = [/(gehalt|lohn|besoldung|entgelt|salary|payroll|bezuege)/];
const rentPatterns = [/(miete|kaltmiete|warmmiete|hausverwaltung|vermietung|wohnungsbau)/];
const groceryPatterns = [
  /(rewe|edeka|aldi|lidl|netto|penny|kaufland|hit|tegut|real|famila)/,
];
const drugstorePatterns = [/(?:\bdm\b|dm-drogerie|rossmann|mueller|muller|müller|budni|drogerie)/];
const publicTransportPatterns = [
  /(deutsche bahn|db fernverkehr|bahncard|nahverkehr|bvg|mvg|vvs|vrr|vrs|hvv|rmv|avv|dvb|s-bahn|u-bahn|deutschlandticket)/,
];
const fuelPatterns = [/(aral|shell|esso|total|star tankstelle|jet\b|avia|omv|teag|agip)/];
const telecomPatterns = [/(telekom|vodafone|o2\b|1und1|1&1|congstar|freenet|telefonica|unitymedia|versatel)/];
const streamingPatterns = [
  /(netflix|spotify|amazon prime|prime video|disney|dazn|audible|apple music|youtube premium)/,
];
const bankFeePatterns = [
  /(kontofuehr|kontoführung|kontoführung|gebuehr|gebühr|entgelt|kartenentgelt|grundpreis)/,
];
const cashWithdrawalPatterns = [
  /(bargeldabhebung|geldautomat|ga automat|cash withdrawal|atm|bargeldauszahlung|atm withdrawal)/,
];

export const RULES: RuleDefinition[] = [
  {
    id: 'income_salary_keywords',
    description: 'Incoming salary keywords',
    priority: 10,
    fn: ctx => {
      if (!ctx.isIncoming) return { type: 'NO_MATCH' };
      if (!hasKeyword(ctx.normalizedText, salaryPatterns)) return { type: 'NO_MATCH' };
      return {
        type: 'MATCH',
        categoryId: 'income_salary',
        ruleId: 'rules.salary.keyword',
        confidence: 0.99,
      };
    },
  },
  {
    id: 'housing_rent_keywords',
    description: 'Outgoing rent keywords',
    priority: 20,
    fn: ctx => {
      if (ctx.isIncoming) return { type: 'NO_MATCH' };
      if (!hasKeyword(ctx.normalizedText, rentPatterns)) return { type: 'NO_MATCH' };
      return {
        type: 'MATCH',
        categoryId: 'housing_rent',
        ruleId: 'rules.housing.rent',
        confidence: 0.95,
      };
    },
  },
  {
    id: 'groceries_supermarkets_keywords',
    description: 'Supermarket chains',
    priority: 30,
    fn: ctx => {
      if (ctx.isIncoming) return { type: 'NO_MATCH' };
      if (!hasKeyword(ctx.normalizedText, groceryPatterns)) return { type: 'NO_MATCH' };
      return {
        type: 'MATCH',
        categoryId: 'groceries_supermarkets',
        ruleId: 'rules.groceries.supermarkets',
        confidence: 0.9,
      };
    },
  },
  {
    id: 'groceries_drugstores_keywords',
    description: 'Drugstore chains',
    priority: 35,
    fn: ctx => {
      if (ctx.isIncoming) return { type: 'NO_MATCH' };
      if (!hasKeyword(ctx.normalizedText, drugstorePatterns)) return { type: 'NO_MATCH' };
      return {
        type: 'MATCH',
        categoryId: 'groceries_drugstores',
        ruleId: 'rules.groceries.drogerie',
        confidence: 0.9,
      };
    },
  },
  {
    id: 'mobility_public_transport_keywords',
    description: 'Public transport providers',
    priority: 40,
    fn: ctx => {
      if (ctx.isIncoming) return { type: 'NO_MATCH' };
      if (!hasKeyword(ctx.normalizedText, publicTransportPatterns)) return { type: 'NO_MATCH' };
      return {
        type: 'MATCH',
        categoryId: 'mobility_public_transport',
        ruleId: 'rules.mobility.public_transport',
        confidence: 0.92,
      };
    },
  },
  {
    id: 'mobility_fuel_auto_keywords',
    description: 'Fuel stations',
    priority: 50,
    fn: ctx => {
      if (ctx.isIncoming) return { type: 'NO_MATCH' };
      if (!hasKeyword(ctx.normalizedText, fuelPatterns)) return { type: 'NO_MATCH' };
      return {
        type: 'MATCH',
        categoryId: 'mobility_fuel_auto',
        ruleId: 'rules.mobility.fuel',
        confidence: 0.88,
      };
    },
  },
  {
    id: 'financial_telecom_internet_keywords',
    description: 'Telecom/Internet providers',
    priority: 60,
    fn: ctx => {
      if (ctx.isIncoming) return { type: 'NO_MATCH' };
      if (!hasKeyword(ctx.normalizedText, telecomPatterns)) return { type: 'NO_MATCH' };
      return {
        type: 'MATCH',
        categoryId: 'financial_telecom_internet',
        ruleId: 'rules.financial.telecom',
        confidence: 0.9,
      };
    },
  },
  {
    id: 'lifestyle_streaming_keywords',
    description: 'Streaming subscriptions',
    priority: 70,
    fn: ctx => {
      if (ctx.isIncoming) return { type: 'NO_MATCH' };
      if (!hasKeyword(ctx.normalizedText, streamingPatterns)) return { type: 'NO_MATCH' };
      return {
        type: 'MATCH',
        categoryId: 'lifestyle_subscriptions_streaming',
        ruleId: 'rules.lifestyle.streaming',
        confidence: 0.9,
      };
    },
  },
  {
    id: 'financial_bank_fees_small_amounts',
    description: 'Low-amount bank fees',
    priority: 80,
    fn: ctx => {
      if (ctx.isIncoming) return { type: 'NO_MATCH' };
      if (ctx.amountAbs > 20) return { type: 'NO_MATCH' };
      if (!hasKeyword(ctx.normalizedText, bankFeePatterns)) return { type: 'NO_MATCH' };
      return {
        type: 'MATCH',
        categoryId: 'financial_bank_fees',
        ruleId: 'rules.financial.bank_fees',
        confidence: 0.85,
      };
    },
  },
  {
    id: 'financial_cash_withdrawal_keywords',
    description: 'Cash withdrawals',
    priority: 90,
    fn: ctx => {
      if (ctx.isIncoming) return { type: 'NO_MATCH' };
      if (!hasKeyword(ctx.normalizedText, cashWithdrawalPatterns)) return { type: 'NO_MATCH' };
      return {
        type: 'MATCH',
        categoryId: 'financial_cash_withdrawal',
        ruleId: 'rules.financial.cash_withdrawal',
        confidence: 0.85,
      };
    },
  },
];

const SORTED_RULES = [...RULES].sort((a, b) => a.priority - b.priority);

export function applyRules(ctx: RuleContext): RuleResult {
  for (const def of SORTED_RULES) {
    const result = def.fn(ctx);
    if (result.type === 'MATCH') {
      return result;
    }
  }
  return { type: 'NO_MATCH' };
}


