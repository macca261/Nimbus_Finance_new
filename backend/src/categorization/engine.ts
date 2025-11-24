import type { ParsedRow } from '../parser/types';
import { normalizeText } from './normalize';
// Import from rulesRuntime to avoid circular dependencies
// rulesRuntime.ts has no imports from engine.ts, index.ts, or orchestrator.ts
import { SYSTEM_RULES, applyRules, applyRulesForRow, applyBasicRules, isUberSubscriptionLike, type ApplyRulesResult } from './rulesRuntime';
import { SYSTEM_MERCHANT_PATTERNS } from './merchantPatterns';
import { fuzzyMatchMerchant } from '../categorizers/fuzzyMatcher';
import { extractUnderlyingMerchantFromPayPal } from './textPreprocessor';

// Startup assertion: verify functions are available and throw if not
// This prevents silent failures where everything gets categorized as "Sonstiges"
if (!process.env.CATEGORIZATION_ENGINE_ASSERTED) {
  const typeApplyRulesForRow = typeof applyRulesForRow;
  const typeApplyBasicRules = typeof applyBasicRules;

  console.log(
    '[categorization] startup check:',
    'typeof applyRulesForRow =',
    typeApplyRulesForRow,
    ', typeof applyBasicRules =',
    typeApplyBasicRules,
  );

  if (typeApplyRulesForRow !== 'function' || typeApplyBasicRules !== 'function') {
    throw new Error(
      '[categorization] FATAL: applyRulesForRow/applyBasicRules are not functions. ' +
      'Check rules module imports and JSON/TS name collisions.'
    );
  }

  process.env.CATEGORIZATION_ENGINE_ASSERTED = 'true';
}
import type {
  CategorizedTransaction,
  CategoryRule,
  MerchantPattern,
} from './types';
import { normalizeMerchant } from './merchants';
import { getOverrideSync } from './overrides';
import { txFingerprint } from '../db';
import { normalize as runNormalizer } from '../normalizer/engine';
import { buildRuleTextContext } from './textPreprocessor';
import { applyHeuristics, detectRecurringPattern, detectSalary, detectRentOrHousing, type HeuristicMatch } from './heuristics';
import { detectTransfer, type TransferMatch } from './transferDetection';

const SEPA_METADATA_REGEX = /\b(?:SVWZ|EREF|MREF|KREF|CRED|IBAN|BIC)\+[^ ]*/gi;
const LONG_ID_REGEX = /\b(?=[0-9A-Z]*\d)[0-9A-Z]{10,}\b/g;

const transliterateGerman = (input: string): string =>
  input
    .replace(/Ä/g, 'AE')
    .replace(/ä/g, 'ae')
    .replace(/Ö/g, 'OE')
    .replace(/ö/g, 'oe')
    .replace(/Ü/g, 'UE')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');

const normalizeForMatch = (input: string): string => {
  let text = transliterateGerman(input);
  text = text.normalize('NFKD').replace(/\p{M}/gu, '');
  text = text.toUpperCase();
  return text.replace(/\s+/g, ' ').trim();
};

const sanitizeForFuzzy = (input: string): string => input.replace(/[^A-Z0-9]/g, '');

export interface EngineContext {
  systemRules?: CategoryRule[];
  merchantPatterns?: MerchantPattern[];
  userRules?: CategoryRule[];
  history?: ParsedRow[]; // Optional transaction history for recurring pattern detection
}

/**
 * Categorization context for passing rules and patterns to the engine.
 * This is a hook point for future DB-backed user rules & merchant patterns.
 */
export interface CategorizationContext {
  systemRules?: CategoryRule[];
  userRules?: CategoryRule[];
  merchantPatterns?: MerchantPattern[];
  history?: ParsedRow[]; // Optional transaction history for recurring pattern detection
}

// ====================================================================================
// Transaction kind inference and category family guards
// ====================================================================================

export type TxKind =
  | 'income'
  | 'income_salary'
  | 'expense'
  | 'transfer_internal'
  | 'refund'
  | 'reimbursement'
  | 'unknown';

function inferTxKind(row: ParsedRow): TxKind {
  // Flags first
  if ((row as any).isRefund || (row as any).isRefunded) return 'refund';
  if ((row as any).isInternalTransfer) return 'transfer_internal';
  if ((row as any).isReimbursement) return 'reimbursement';

  const text = `${row.counterparty ?? ''} ${row.rawText ?? ''}`.toUpperCase();
  if (row.amountCents > 0) {
    if (
      text.includes('GEHALT') ||
      text.includes('LOHN') ||
      text.includes('SALARY') ||
      text.includes('PAYROLL')
    ) {
      return 'income_salary';
    }
    return 'income';
  }
  if (row.amountCents < 0) return 'expense';
  return 'unknown';
}

type CategoryFamily = 'income' | 'expense' | 'transfer' | 'other';

function getCategoryFamily(category: string): CategoryFamily {
  if (!category) return 'other';
  if (category.startsWith('income')) return 'income';
  if (category.startsWith('internal')) return 'transfer';
  if (category === 'other' || category.startsWith('other')) return 'other';
  return 'expense';
}

function applySignCategoryGuards(
  txKind: TxKind,
  row: ParsedRow,
  categorized: CategorizedTransaction,
): CategorizedTransaction {
  const family = getCategoryFamily(categorized.category as any);
  // Income amount but expense category
  if ((row.direction === 'in' || row.amountCents > 0) && family === 'expense') {
    const patched: CategorizedTransaction = { ...categorized };
    patched.category = (txKind === 'income_salary' ? 'income:salary' : 'income:freelance') as any;
    patched.categorySource = 'sanity_guard' as any;
    patched.categoryConfidence = Math.min(patched.categoryConfidence ?? 0.4, 0.4);
    if (patched.categoryExplanation) {
      patched.categoryExplanation.ruleId = 'sign_guard_income_expense_mismatch';
    } else {
      (patched as any).categoryExplanation = { ruleId: 'sign_guard_income_expense_mismatch' };
    }
    return patched;
  }
  // Expense amount but income category
  if ((row.direction === 'out' || row.amountCents < 0) && family === 'income') {
    const patched: CategorizedTransaction = { ...categorized };
    patched.category = 'other' as any;
    patched.categorySource = 'sanity_guard' as any;
    patched.categoryConfidence = Math.min(patched.categoryConfidence ?? 0.4, 0.4);
    if (patched.categoryExplanation) {
      patched.categoryExplanation.ruleId = 'sign_guard_expense_income_mismatch';
    } else {
      (patched as any).categoryExplanation = { ruleId: 'sign_guard_expense_income_mismatch' };
    }
    return patched;
  }
  return categorized;
}

type RuleMatch = {
  category: string;
  score: number;
  source: 'rule' | 'user';
  ruleId: string;
};

type MerchantMatch = {
  merchant: string;
  category?: string;
  score: number;
  patternId: string;
};

const stableOverrideId = (row: ParsedRow): string | undefined => {
  const raw = (row.raw ?? {}) as Record<string, unknown>;
  const externalId = raw?.externalId;
  if (typeof externalId === 'string' && externalId.trim().length > 0) {
    return externalId.trim();
  }

  try {
    return txFingerprint({
      bookingDate: row.bookingDate,
      valueDate: row.valutaDate ?? row.bookingDate,
      amountCents: row.amountCents,
      currency: (row.currency ?? 'EUR').toUpperCase(),
      purpose: row.rawText ?? row.reference ?? '',
      counterpartName: row.counterparty ?? undefined,
      accountIban: row.accountIban ?? undefined,
    } as any);
  } catch {
    return undefined;
  }
};

const normalizeDescription = (row: ParsedRow): string => {
  const candidates: string[] = [];
  if (typeof row.normalizedText === 'string' && row.normalizedText.trim().length > 0) {
    candidates.push(row.normalizedText);
  }
  if (row.rawText?.trim()) candidates.push(row.rawText);
  if (row.reference?.trim()) candidates.push(row.reference);
  if (row.counterparty?.trim()) candidates.push(row.counterparty);

  let base = candidates.join(' ').trim();
  if (!base && typeof row.raw?.description === 'string') {
    base = row.raw.description as string;
  }

  let text = normalizeText(base);
  text = text.replace(SEPA_METADATA_REGEX, ' ');
  text = text.replace(LONG_ID_REGEX, ' ');
  return normalizeForMatch(text);
};

const detectMerchant = (
  normalized: string,
  patterns: MerchantPattern[],
): MerchantMatch | null => {
  const normalizedCompact = sanitizeForFuzzy(normalized);
  const normalizedUpper = normalized.toUpperCase();

  let best: MerchantMatch | null = null;

  for (const pattern of patterns) {
    const patternText = pattern.pattern.toUpperCase();
    const patternCompact = sanitizeForFuzzy(patternText);

    const hasExact = pattern.exact
      ? normalized.includes(patternText.trim())
      : normalized.includes(patternText);

    const hasFuzzy =
      !pattern.exact && patternCompact.length > 0
        ? normalizedCompact.includes(patternCompact)
        : false;

    if (!hasExact && !hasFuzzy) continue;

    // Special handling for Uber patterns: exclude subscription keywords
    // This prevents "UBER PASS Membership" from matching "UBER TRIP" pattern
    if (pattern.id === 'uber' && pattern.category === 'transport:rideshare') {
      if (isUberSubscriptionLike(normalizedUpper)) {
        continue; // Skip this pattern match - subscription will be handled by heuristic
      }
    }

    if (!best || pattern.score > best.score) {
      best = {
        merchant: pattern.normalized,
        category: pattern.category,
        score: pattern.score,
        patternId: pattern.id,
      };
    } else if (best && pattern.score === best.score) {
      // deterministic tie-breaker
      if (pattern.id < best.patternId) {
        best = {
          merchant: pattern.normalized,
          category: pattern.category,
          score: pattern.score,
          patternId: pattern.id,
        };
      }
    }
  }

  return best;
};

const evaluateRule = (
  rule: CategoryRule,
  row: ParsedRow,
  normalizedDescription: string,
  merchantMatch: MerchantMatch | null,
): boolean => {
  if (!rule.enabled) return false;

  const when = rule.when ?? {};

  if (when.direction && when.direction !== row.direction) return false;

  if (when.contains) {
    const normalizedTokens = when.contains.map(token => normalizeForMatch(token));
    const hasMatch = normalizedTokens.some(token => normalizedDescription.includes(token));
    if (!hasMatch) return false;
  }

  if (when.regex) {
    try {
      const regex = new RegExp(when.regex, 'i');
      if (!regex.test(normalizedDescription)) return false;
    } catch (error) {
      return false;
    }
  }

  if (when.ibanEquals) {
    const expected = when.ibanEquals.toUpperCase();
    const counterpartyIban = row.counterpartyIban?.toUpperCase();
    if (!counterpartyIban || counterpartyIban !== expected) return false;
  }

  if (when.mccIn) {
    const mcc = row.mcc?.toUpperCase();
    const allowed = when.mccIn.map(code => code.toUpperCase());
    if (!mcc || !allowed.includes(mcc)) return false;
  }

  if (when.merchantEquals) {
    const candidateMerchant = merchantMatch?.merchant?.toUpperCase();
    if (!candidateMerchant || candidateMerchant !== when.merchantEquals.toUpperCase()) {
      return false;
    }
  }

  if (typeof when.minAmountAbs === 'number') {
    if (Math.abs(row.amountCents) < when.minAmountAbs) return false;
  }

  if (typeof when.maxAmountAbs === 'number') {
    if (Math.abs(row.amountCents) > when.maxAmountAbs) return false;
  }

  return true;
};

const selectBestMatch = (
  candidates: RuleMatch[],
  merchantCandidate: MerchantMatch | null,
): RuleMatch | null => {
  const allCandidates = [...candidates];

  if (merchantCandidate?.category) {
    allCandidates.push({
      category: merchantCandidate.category,
      score: merchantCandidate.score,
      source: 'rule',
      ruleId: `merchant:${merchantCandidate.patternId}`,
    });
  }

  if (allCandidates.length === 0) return null;

  allCandidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.source !== b.source) {
      return a.source === 'user' ? -1 : 1;
    }
    return a.ruleId.localeCompare(b.ruleId);
  });

  return allCandidates[0];
};

const scoreToConfidence = (score: number): number => {
  if (score >= 220) return 1;
  if (score >= 180) return 0.9;
  if (score >= 150) return 0.8;
  return Math.min(0.7, Math.max(0.4, score / 200));
};

function adjustConfidenceForSignMismatch(row: ParsedRow, category: string, confidence: number): number {
  // Simple top-level group detection by prefix
  const isIncomeCategory = category.startsWith('income');
  const isExpenseCategory = !isIncomeCategory && !category.startsWith('internal');
  // Income amount is positive (direction 'in'), expenses are negative (direction 'out')
  const isIncomeAmount = row.direction === 'in' || row.amountCents > 0;
  const isExpenseAmount = row.direction === 'out' || row.amountCents < 0;

  // If sign/group mismatch, clamp confidence to low (<= 0.4)
  if (isIncomeAmount && isExpenseCategory) {
    return Math.min(confidence, 0.4);
  }
  if (isExpenseAmount && isIncomeCategory) {
    return Math.min(confidence, 0.4);
  }
  return confidence;
}

/**
 * 6-Stage Categorization Pipeline
 * 
 * Stage 1: Per-transaction override (manual category set in UI)
 * Stage 2: User rules ("immer so kategorisieren")
 * Stage 3: System rules / merchant dictionaries
 * Stage 4: Heuristics (direction, keywords, periodicity)
 * Stage 5: Transfer / internal movement detection
 * Stage 6: Final fallback
 */
export function categorizeWithRules(
  row: ParsedRow,
  ctx: EngineContext | CategorizationContext = {
    systemRules: SYSTEM_RULES,
    merchantPatterns: SYSTEM_MERCHANT_PATTERNS,
  },
): CategorizedTransaction {
  const txKind = inferTxKind(row);
  const normalizedDescription = normalizeDescription(row);
  const merchantInfo = normalizeMerchant(row.rawText ?? undefined, row.counterparty);
  const candidateParts = [
    row.rawText,
    typeof row.counterparty === 'string' ? row.counterparty : null,
    typeof row.reference === 'string' ? row.reference : null,
  ].filter((part): part is string => Boolean(part && part.trim()));
  const candidateText = candidateParts.join(' ');
  const normalizerResult = runNormalizer({
    text: candidateText,
    counterparty: row.counterparty ?? undefined,
  });
  const normalizedText = row.normalizedText ?? normalizeText(row.rawText ?? '');
  
  // Build cleaned text context for better rule matching
  const textContext = buildRuleTextContext(row);
  const cleanedText = textContext.cleanedText;
  
  // Extract merchant name (prefer normalizer, then merchantInfo, then preprocessor hint)
  let merchantName = normalizerResult.merchant ?? 
                      merchantInfo.merchant ?? 
                      row.counterparty ?? 
                      textContext.merchantHint ?? 
                      undefined;

  // ============================================
  // PAYPAL ENRICHMENT: Extract underlying merchant from PayPal transactions
  // ============================================
  // If the merchant is PayPal (or rawText contains PayPal), try to extract the underlying merchant
  const merchantNameNormalized = (merchantName ?? '').toUpperCase().trim();
  const isPayPalTransaction = merchantNameNormalized.includes('PAYPAL') || 
                               (row.rawText?.toUpperCase().includes('PAYPAL') ?? false);
  
  if (isPayPalTransaction && row.rawText) {
    const underlyingMerchant = extractUnderlyingMerchantFromPayPal(row.rawText);
    if (underlyingMerchant && underlyingMerchant.trim().length >= 2) {
      // Override merchantName with the extracted underlying merchant
      // This allows rules and fuzzy matching to work on the actual merchant, not "PayPal"
      merchantName = underlyingMerchant.trim();
      
      if (process.env.NODE_ENV === 'development') {
        console.log(
          '[categorization] PayPal enrichment',
          {
            original: normalizerResult.merchant ?? merchantInfo.merchant ?? row.counterparty,
            extracted: underlyingMerchant,
          },
        );
      }
    }
  }

  // Prepare base categorized transaction
  const baseCategorized: CategorizedTransaction = {
    ...row,
    normalizedText,
    normalizedDescription,
    merchant: merchantName,
    categorySystem: 'nimbus-v1',
  };

  if (normalizerResult.matchedRuleId) {
    const rawRecord = { ...(baseCategorized.raw ?? {}) };
    rawRecord.normalizerMatchedRuleId = normalizerResult.matchedRuleId;
    baseCategorized.raw = rawRecord;
  }

  if (normalizerResult.categoryHint && (row.category === undefined || row.category === null)) {
    baseCategorized.categoryHint = normalizerResult.categoryHint;
  }

  // Hard override for cash withdrawals: always assign cash:withdrawal category and stop
  const applyCashWithdrawalOverride = (): CategorizedTransaction | null => {
    if (!(row as any).isCashWithdrawal) return null;
    return {
      ...baseCategorized,
      category: 'cash:withdrawal',
      categorySource: 'system',
      categoryConfidence: 0.95,
      categoryExplanation: {
        ruleId: 'cash_withdrawal:auto',
      },
    };
  };
  const cashWithdrawalOverride = applyCashWithdrawalOverride();
  if (cashWithdrawalOverride) {
    return cashWithdrawalOverride;
  }

  // Hard override for internal transfers: always assign internal categories and stop
  const applyInternalTransferOverride = (): CategorizedTransaction | null => {
    if (!(row as any).isInternalTransfer) return null;
    const kind = (row as any).internalTransferKind as ('savings' | 'wallet' | 'other' | null | undefined);
    let categoryId = 'internal:transfer_other';
    if (kind === 'savings') categoryId = 'internal:transfer_savings';
    else if (kind === 'wallet') categoryId = 'internal:transfer_wallet';
    return {
      ...baseCategorized,
      category: categoryId,
      categorySource: 'system',
      categoryConfidence: 0.9,
      categoryExplanation: {
        ruleId: `internal_transfer:${kind ?? 'other'}`,
      },
    };
  };
  const internalOverride = applyInternalTransferOverride();
  if (internalOverride) {
    return internalOverride;
  }

  // ============================================
  // STAGE 1: Per-transaction override (manual category set in UI)
  // ============================================
  const overrideId = stableOverrideId(row);
  const override = overrideId ? getOverrideSync(overrideId) : null;
  if (override) {
    return {
      ...baseCategorized,
      category: override.category as any,
      categorySource: 'user',
      categoryConfidence: 1,
    };
  }

  // ============================================
  // STAGE 2: User rules ("immer so kategorisieren") - always allowed
  // ============================================
  if (ctx.userRules && ctx.userRules.length > 0) {
    try {
      const userRulesResult = applyRulesForRow(row, {
        systemRules: [],
        userRules: ctx.userRules,
      });
      if (userRulesResult.categoryId) {
        return {
          ...baseCategorized,
          category: userRulesResult.categoryId,
          categorySource: 'user',
          categoryConfidence: 0.95,
        };
      }
    } catch (err) {
      console.warn('[categorization] user rules evaluation failed', err);
    }
  }

  // ============================================
  // STAGE 3: System rules / merchant dictionaries
  // Only for expense-like transactions. Skip for income kinds to avoid mislabels.
  // ============================================
  let systemRuleHit: { category: string; source: 'rule' | 'user'; ruleId?: string; confidence?: number; merchantName?: string; matchedText?: string } | null = null;
  
  const ruleCategoryAllowed = (txk: TxKind, cat: string): boolean => {
    const fam = getCategoryFamily(cat);
    if (txk === 'income' || txk === 'income_salary') {
      return fam === 'income' || fam === 'transfer';
    }
    if (txk === 'expense') {
      return fam === 'expense' || fam === 'transfer' || fam === 'other';
    }
    // For transfer/refund/reimbursement/unknown allow but guards will fix later
    return true;
  };

  // Try simple applyRules API first (uses cleaned text)
  if (typeof applyRules === 'function') {
    try {
      const hit = applyRules(merchantName, cleanedText || (row.rawText ?? ''));
      if (hit) {
        // Convert RuleHit to expected format, filtering out 'ml' source
        if (hit.source === 'rule' || hit.source === 'user') {
          if (ruleCategoryAllowed(txKind, hit.category)) {
            systemRuleHit = {
              category: hit.category,
              source: hit.source,
              ruleId: hit.ruleId,
              confidence: hit.confidence,
              merchantName: hit.merchantName,
              matchedText: hit.matchedText,
            };
          }
        }
      }
    } catch (err) {
      console.warn('[categorization] applyRules failed, trying advanced engine', err);
    }
  }

  // Fallback to advanced rule engine if simple API didn't match
  if (!systemRuleHit) {
    try {
      const advancedResult = applyRulesForRow(row, {
        systemRules: ctx.systemRules ?? SYSTEM_RULES,
        userRules: ctx.userRules,
      });
      if (advancedResult.categoryId) {
        if (ruleCategoryAllowed(txKind, advancedResult.categoryId)) {
          systemRuleHit = {
            category: advancedResult.categoryId,
            source: 'rule',
            confidence: advancedResult.confidence ?? 0.9,
          };
        }
      }
    } catch (err) {
      console.warn('[categorization] advanced rule engine failed', err);
    }
  }

  // Also check legacy basic rules as fallback
  if (!systemRuleHit) {
    try {
      const basicRuleHit = applyBasicRules(merchantInfo.merchant, row.rawText ?? '');
      if (basicRuleHit) {
        if (ruleCategoryAllowed(txKind, basicRuleHit.category)) {
          systemRuleHit = {
            category: basicRuleHit.category,
            source: 'rule',
            confidence: 0.85,
          };
        }
      }
    } catch (err) {
      // Silently continue if basic rules fail
    }
  }

  if (systemRuleHit) {
    let confidence = systemRuleHit.confidence ?? 
                      (systemRuleHit.category === 'income:salary' ? 1.0 :
                      systemRuleHit.category.startsWith('fees:') ? 0.95 :
                      0.9);
    confidence = adjustConfidenceForSignMismatch(row, systemRuleHit.category, confidence);
    
    const result: CategorizedTransaction = {
      ...baseCategorized,
      category: systemRuleHit.category,
      categorySource: systemRuleHit.source,
      categoryConfidence: confidence,
    };
    
    // Add explanation if available
    if (systemRuleHit.ruleId) {
      result.categoryExplanation = {
        ruleId: systemRuleHit.ruleId,
        merchantName: systemRuleHit.merchantName,
        matchedText: systemRuleHit.matchedText,
      };
    }
    
    return applySignCategoryGuards(txKind, row, result);
  }

  // ============================================
  // STAGE 3.5: Fuzzy merchant matching (merchant DB)
  // ============================================
  // Only run if no system rule matched
  if (!systemRuleHit && merchantName) {
    try {
      // Normalize merchant name for fuzzy matching
      // Use the merchant name we extracted, or fall back to counterparty/rawText
      const merchantNameForFuzzy = merchantName || 
                                   merchantInfo.merchant || 
                                   row.counterparty || 
                                   '';
      
      if (merchantNameForFuzzy && merchantNameForFuzzy.trim().length >= 3) {
        const fuzzy = fuzzyMatchMerchant(merchantNameForFuzzy, {
          minScore: 0.80, // Use DEFAULT_MIN_SCORE from fuzzyMatcher
          maxCandidates: 3,
        });
        
        if (fuzzy && fuzzy.score >= 0.80) {
          // Map category using the same logic as system rules
          // We need to import mapNimbusCategoryToLegacy, but it's in index.ts
          // For now, use the category directly (it should already be a valid nimbus category)
          const mappedCategory = fuzzy.category; // Will be mapped later in index.ts
          if (!ruleCategoryAllowed(txKind, mappedCategory)) {
            // Skip fuzzy suggestion that violates category family
            return {
              ...baseCategorized,
              category: 'other',
              categorySource: 'unknown',
              categoryConfidence: 0.1,
            };
          }
          
          if (process.env.NODE_ENV === 'development') {
            console.log(
              '[categorization] fuzzy merchant match',
              { 
                input: merchantNameForFuzzy, 
                matched: fuzzy.canonicalName, 
                score: fuzzy.score.toFixed(3), 
                category: fuzzy.category 
              },
            );
          }
          
          const base: CategorizedTransaction = {
            ...baseCategorized,
            category: mappedCategory,
            categorySource: 'merchant-db-fuzzy',
            categoryConfidence: Math.max(0.85, fuzzy.score),
            merchant: fuzzy.canonicalName,
            categoryExplanation: {
              ruleId: `fuzzy:${fuzzy.merchantId ?? 'unknown'}`,
              merchantName: fuzzy.canonicalName,
            },
          };
          base.categoryConfidence = adjustConfidenceForSignMismatch(row, base.category ?? 'other', base.categoryConfidence ?? 0.85);
          return applySignCategoryGuards(txKind, row, base);
        }
      }
    } catch (err) {
      console.warn('[categorization] fuzzy merchant matching failed', err);
      // Continue to next stage
    }
  }

  // ============================================
  // STAGE 4: Heuristics (direction, keywords, periodicity)
  // ============================================
  // Only run heuristics if no category was set yet, or confidence is low (< 0.7)
  // This ensures we never override high-confidence rule/fuzzy/user categorizations
  const currentCategory = baseCategorized.category;
  const currentConfidence = baseCategorized.categoryConfidence ?? 0;
  const shouldRunHeuristics = !currentCategory || 
                               currentCategory === 'other' || 
                               currentConfidence < 0.7;

  // Try recurring pattern detection (requires history)
  // This can override earlier rules if it finds a recurring pattern, especially for Uber subscriptions
  if (ctx.history && ctx.history.length >= 2) {
    const recurringResult = detectRecurringPattern(row, ctx.history);
    if (recurringResult) {
      // Check if this is an Uber transaction that might be a subscription
      const isUberTransaction = (merchantName?.toUpperCase().includes('UBER') ?? false) ||
                                (row.rawText?.toUpperCase().includes('UBER') ?? false);
      
      // For Uber transactions, allow recurring detection to override if it finds a subscription pattern
      // This ensures monthly Uber One/Pass charges are marked as recurring even if initially
      // categorized as transport:rideshare by the base rule
      const isUberSubscription = isUberTransaction && 
                                 recurringResult.reason === 'heuristic:recurring' &&
                                 recurringResult.category === 'transport:rideshare';
      
      // Recurring detection can override if:
      // 1. No category set yet, OR
      // 2. Category is 'other', OR
      // 3. Recurring confidence is higher, OR
      // 4. This is an Uber subscription (should always override base Uber rule)
      const shouldOverride = !currentCategory || 
                             currentCategory === 'other' || 
                             recurringResult.confidence > (currentConfidence ?? 0) ||
                             isUberSubscription;
      
      if (shouldOverride) {
        return applySignCategoryGuards(txKind, row, {
          ...baseCategorized,
          category: recurringResult.category,
          categorySource: recurringResult.reason as any, // 'heuristic:recurring' or similar
          categoryConfidence: recurringResult.confidence,
          categoryExplanation: {
            ruleId: recurringResult.reason,
          },
        });
      }
    }
  }

  if (shouldRunHeuristics) {

    // Income-only heuristics (salary)
    if (txKind === 'income' || txKind === 'income_salary') {
      const salaryMatch = detectSalary(row, cleanedText);
      if (salaryMatch) {
        return applySignCategoryGuards(txKind, row, {
          ...baseCategorized,
          category: salaryMatch.category,
          categorySource: 'heuristic:salary',
          categoryConfidence: salaryMatch.confidence,
          categoryExplanation: {
            ruleId: salaryMatch.reason,
          },
        });
      }
    }

    // Expense-only heuristics
    if (txKind === 'expense') {
      const rentMatch = detectRentOrHousing(row, cleanedText);
      if (rentMatch) {
        return applySignCategoryGuards(txKind, row, {
          ...baseCategorized,
          category: rentMatch.category,
          categorySource: rentMatch.reason as any, // 'heuristic:rent' or 'heuristic:housing'
          categoryConfidence: rentMatch.confidence,
          categoryExplanation: {
            ruleId: rentMatch.reason,
          },
        });
      }
    }

    // Fall back to general heuristics (but keep separated by kind via row.direction)
    const heuristicMatch = applyHeuristics(row, cleanedText);
    if (heuristicMatch) {
      // Map reason to categorySource
      let categorySource: string = 'fallback';
      if (heuristicMatch.reason.startsWith('heuristic:')) {
        categorySource = heuristicMatch.reason;
      }

      return applySignCategoryGuards(txKind, row, {
        ...baseCategorized,
        category: heuristicMatch.category,
        categorySource: categorySource as any,
        categoryConfidence: heuristicMatch.confidence,
        categoryExplanation: {
          ruleId: heuristicMatch.reason,
        },
      });
    }
  }

  // ============================================
  // STAGE 5: Transfer / internal movement detection
  // ============================================
  const transferMatch = detectTransfer(row, cleanedText);
  if (transferMatch) {
    const res: CategorizedTransaction = {
      ...baseCategorized,
      category: transferMatch.category,
      categorySource: 'fallback',
      categoryConfidence: transferMatch.confidence,
      categoryExplanation: {
        ruleId: transferMatch.reason,
      },
    };
    res.categoryConfidence = adjustConfidenceForSignMismatch(row, res.category ?? 'other', res.categoryConfidence ?? 0.7);
    return applySignCategoryGuards(txKind, row, res);
  }

  // ============================================
  // STAGE 6: Final fallback
  // ============================================
  return applySignCategoryGuards(txKind, row, {
    ...baseCategorized,
    category: 'other',
    categorySource: 'unknown',
    categoryConfidence: 0.1,
  });
}

