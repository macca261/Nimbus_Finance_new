import type { ParsedRow } from '../parser/types';
import { normalizeText } from './normalize';
import { SYSTEM_RULES } from './rules';
import { SYSTEM_MERCHANT_PATTERNS } from './merchantPatterns';
import type {
  CategorizedTransaction,
  CategoryRule,
  MerchantPattern,
} from './types';

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
  systemRules: CategoryRule[];
  merchantPatterns: MerchantPattern[];
  userRules?: CategoryRule[];
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

export function categorizeWithRules(
  row: ParsedRow,
  ctx: EngineContext = {
    systemRules: SYSTEM_RULES,
    merchantPatterns: SYSTEM_MERCHANT_PATTERNS,
  },
): CategorizedTransaction {
  const normalizedDescription = normalizeDescription(row);
  const merchantMatch = detectMerchant(normalizedDescription, ctx.merchantPatterns);

  const combinedRules = [...(ctx.userRules ?? []), ...ctx.systemRules];

  const ruleMatches: RuleMatch[] = [];
  for (const rule of combinedRules) {
    if (!evaluateRule(rule, row, normalizedDescription, merchantMatch)) continue;
    ruleMatches.push({
      category: rule.setCategory,
      score: rule.score,
      source: rule.source === 'user' ? 'user' : 'rule',
      ruleId: rule.id,
    });
  }

  const normalizedText = row.normalizedText ?? normalizeText(row.rawText ?? '');

  const best = selectBestMatch(ruleMatches, merchantMatch);

  const categorized: CategorizedTransaction = {
    ...row,
    normalizedText,
    normalizedDescription,
    merchant: merchantMatch?.merchant ?? row.counterparty ?? undefined,
  };

  if (best) {
    return {
      ...categorized,
      categorySystem: 'nimbus-v1',
      category: best.category,
      categorySource: best.source,
      categoryConfidence: scoreToConfidence(best.score),
    };
  }

  return {
    ...categorized,
    categorySystem: 'nimbus-v1',
    category: 'other',
    categorySource: 'unknown',
    categoryConfidence: 0.1,
  };
}

