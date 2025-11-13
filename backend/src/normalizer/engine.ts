import { db } from '../db';
import type { NormalizationRule, NormalizerResult, RuleMatcher } from './types';

let cachedRules: NormalizationRule[] | null = null;

const STRIP_DIACRITICS_REGEX = /\p{M}/gu;

const normalizeString = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(STRIP_DIACRITICS_REGEX, '')
    .toLowerCase();

const sanitizePattern = (pattern: string): string => normalizeString(pattern).trim();

type Corpus = {
  corpus: string;
  tokens: string[];
};

const buildCorpus = (text: string, counterparty?: string | null): Corpus => {
  const pieces = [text ?? '', counterparty ?? ''].filter(Boolean);
  const joined = pieces.join(' ');
  const normalized = normalizeString(joined).replace(/\s+/g, ' ').trim();
  const tokens = normalized.length ? normalized.split(' ') : [];
  return { corpus: normalized, tokens };
};

const matchesContains = (corpus: Corpus, pattern: string) =>
  corpus.corpus.includes(pattern);

const matchesStartsWith = (corpus: Corpus, pattern: string) =>
  corpus.corpus.startsWith(pattern) || corpus.tokens.some(token => token.startsWith(pattern));

const matchesEquals = (corpus: Corpus, pattern: string) =>
  corpus.corpus === pattern || corpus.tokens.some(token => token === pattern);

const matcherHandlers: Record<RuleMatcher, (corpus: Corpus, pattern: string, rawPattern: string) => boolean> = {
  contains: (corpus, pattern) => !!pattern && matchesContains(corpus, pattern),
  startsWith: (corpus, pattern) => !!pattern && matchesStartsWith(corpus, pattern),
  equals: (corpus, pattern) => !!pattern && matchesEquals(corpus, pattern),
  regex: (corpus, _pattern, rawPattern) => {
    try {
      const regex = new RegExp(rawPattern, 'i');
      return regex.test(corpus.corpus);
    } catch {
      return false;
    }
  },
};

export function clearRulesCache(): void {
  cachedRules = null;
}

export function loadRules(): NormalizationRule[] {
  if (cachedRules) return cachedRules;

  const rows = db
    .prepare(`
      SELECT id,
             is_active,
             priority,
             matcher,
             pattern,
             normalizeTo,
             categoryHint,
             notes,
             createdAt,
             updatedAt
      FROM normalization_rules
      WHERE is_active = 1
      ORDER BY priority ASC, createdAt ASC
    `)
    .all() as Array<{
      id: string;
      is_active: number;
      priority: number;
      matcher: RuleMatcher;
      pattern: string;
      normalizeTo: string;
      categoryHint?: string | null;
      notes?: string | null;
      createdAt: string;
      updatedAt: string;
    }>;

  cachedRules = rows.map(row => ({
    ...row,
    is_active: Boolean(row.is_active),
    categoryHint: row.categoryHint ?? null,
    notes: row.notes ?? null,
  }));

  return cachedRules;
}

export function normalize(input: { text: string; counterparty?: string | null }): NormalizerResult {
  const rules = loadRules();
  if (!rules.length) return {};

  const corpusData = buildCorpus(input.text ?? '', input.counterparty ?? null);

  for (const rule of rules) {
    const handler = matcherHandlers[rule.matcher];
    if (!handler) continue;

    const normalizedPattern = rule.matcher === 'regex' ? rule.pattern : sanitizePattern(rule.pattern);
    if (!normalizedPattern) continue;

    const matched = handler(corpusData, normalizedPattern, rule.pattern);
    if (!matched) continue;

    return {
      merchant: rule.normalizeTo,
      categoryHint: rule.categoryHint ?? null,
      matchedRuleId: rule.id,
    };
  }

  return {};
}


