/**
 * Runtime rules module - pure functions with no circular dependencies.
 * 
 * This module contains all runtime logic for rule application:
 * - JSON loading from legacyRules.json (renamed from rules.json to avoid module collision)
 * - SYSTEM_RULES_CONFIG construction
 * - applyRulesForRow and applyBasicRules functions
 * 
 * CRITICAL: This module must NOT import from:
 * - ./engine
 * - ./index
 * - ./orchestrator
 * 
 * It can only import:
 * - Types from ./types, ./categoryRegistry
 * - Pure utilities (no side effects)
 */

import type { ParsedRow } from '../parser/types';
import type { CategoryRule, MerchantPattern } from './types';
import type { CategoryId } from './categoryRegistry';
import type { NimbusCategoryId } from './taxonomy';
import fs from 'node:fs';
import path from 'node:path';

// ============================================================================
// JSON Loading (Legacy Rules)
// ============================================================================

// Load JSON at runtime to avoid module loading issues with ts-node-dev
// This works reliably in both dev (ts-node-dev) and build (compiled JS) modes
let rawRules: Array<{ if: { merchant?: string[]; textContains?: string[] }; category: string }>;
try {
  // In dev mode (ts-node-dev), __dirname points to src/categorization
  // In build mode, __dirname points to dist/categorization
  // Try multiple locations to handle both cases
  let rulesJsonPath: string | null = null;
  
  // First try: relative to __dirname (works in both dev and build)
  const dirnamePath = path.join(__dirname, 'legacyRules.json');
  if (fs.existsSync(dirnamePath)) {
    rulesJsonPath = dirnamePath;
  } else {
    // Fallback: try relative to process.cwd() for dev mode
    const cwdPath = path.join(process.cwd(), 'src', 'categorization', 'legacyRules.json');
    if (fs.existsSync(cwdPath)) {
      rulesJsonPath = cwdPath;
    }
  }
  
  if (!rulesJsonPath) {
    throw new Error('Could not find legacyRules.json in expected locations');
  }
  
  const rulesJsonContent = fs.readFileSync(rulesJsonPath, 'utf-8');
  rawRules = JSON.parse(rulesJsonContent);
} catch (err) {
  console.error('[categorization/rulesRuntime] Failed to load legacyRules.json:', err);
  // Fallback to empty array so module still loads - this prevents the entire module from failing
  // The module will still export functions, they just won't have legacy rules
  rawRules = [];
}

// ============================================================================
// Text Normalization
// ============================================================================

/**
 * Normalize text for matching: uppercase, remove diacritics, squeeze whitespace.
 */
function normalize(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return '';
  let text = String(input)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '') // Remove diacritics
    .toUpperCase();
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Normalize text for matching: uppercase, remove diacritics, squeeze whitespace.
 */
function normalizeForMatch(input: string): string {
  return normalize(input);
}

/**
 * Check if a haystack string contains Uber subscription keywords.
 * This is the single source of truth for "does this look like an Uber subscription?"
 * 
 * @param haystack - Combined merchant + text string (should be uppercase)
 * @returns true if the haystack contains subscription keywords (PASS, ONE, MEMBERSHIP, ABO)
 */
export function isUberSubscriptionLike(haystack: string): boolean {
  const upper = haystack.toUpperCase();
  return (
    upper.includes('PASS') ||
    upper.includes('ONE') ||
    upper.includes('MEMBERSHIP') ||
    upper.includes('ABO')
  );
}

// ============================================================================
// System Rules Configuration
// ============================================================================

/**
 * Rule configuration for structured rule matching.
 */
interface RuleConfig {
  id: string;
  category: CategoryId | NimbusCategoryId; // Can be either legacy CategoryId or NimbusCategoryId
  source?: 'rule' | 'user' | 'ml'; // default 'rule'
  match: (merchantNorm: string, textNorm: string) => boolean;
  defaultConfidence?: number;
}

/**
 * Guard: generic bank transfer (avoid misclassifying as transport/Uber).
 * 
 * Detects patterns like "Übertrag / Überweisung | Empfänger: ... IBAN: ..."
 * which are plain bank transfers, NOT Uber rides.
 * 
 * Must normalize diacritics first: "Übertrag" → "UBERTRAG" (not "ÜBERTRAG")
 * to properly detect the pattern and exclude it from Uber matching.
 */
function isGenericBankTransfer(text: string): boolean {
  // Normalize diacritics first: "Übertrag" → "UBERTRAG"
  const normalized = normalize(text || '');
  
  // Check for transfer keywords (after normalization)
  const hasTransferKeyword = normalized.includes('UBERTRAG') || 
                             normalized.includes('UBERWEISUNG');
  
  if (!hasTransferKeyword) return false;
  
  // Exclude real Uber rides (must have "UBER " or "UBER*" as a word, not just "UBERTRAG")
  // After normalization, "Übertrag" becomes "UBERTRAG" which doesn't contain "UBER " (with space)
  const hasRealUber = normalized.includes('UBER ') || 
                       normalized.includes('UBER*') ||
                       normalized.includes('UBER.COM') ||
                       normalized.includes('UBER TRIP');
  
  // Exclude transport-specific transfers (Bahn, ÖPNV, tickets)
  const hasTransportSignal = normalized.includes('BAHN') ||
                             normalized.includes('OPNV') ||
                             normalized.includes('TICKET');
  
  // If it has transfer keywords but no real Uber signals and no transport signals, it's a generic transfer
  return hasTransferKeyword && !hasRealUber && !hasTransportSignal;
}

/**
 * System rules that match merchant names and text patterns.
 * These rules are used by the public applyRules(merchant, rawText) API.
 * Structured as RuleConfig for richer information.
 */
export const SYSTEM_RULES_CONFIG: RuleConfig[] = [
  // Supermarkets cluster (REWE, ALDI, LIDL, EDEKA, NETTO, PENNY, KAUFLAND, GLOBUS, FAMILA)
  {
    id: 'supermarket:rewe',
    category: 'groceries',
    match: (m, t) => m.includes('REWE') || t.includes('REWE'),
    defaultConfidence: 0.95,
  },
  {
    id: 'supermarket:aldi',
    category: 'groceries',
    match: (m, t) => m.includes('ALDI') || t.includes('ALDI'),
    defaultConfidence: 0.95,
  },
  {
    id: 'supermarket:lidl',
    category: 'groceries',
    match: (m, t) => {
      // Match LIDL in various forms, including "Lidl sagt Danke" (case-insensitive after normalization)
      const lidlPatterns = ['LIDL', 'LIDL SAGT DANKE', 'LIDL SAGT', 'LIDL MARKT'];
      return lidlPatterns.some(pattern => m.includes(pattern) || t.includes(pattern));
    },
    defaultConfidence: 0.95,
  },
  {
    id: 'supermarket:edeka',
    category: 'groceries',
    match: (m, t) => m.includes('EDEKA') || t.includes('EDEKA'),
    defaultConfidence: 0.95,
  },
  {
    id: 'supermarket:netto',
    category: 'groceries',
    match: (m, t) => m.includes('NETTO') || t.includes('NETTO'),
    defaultConfidence: 0.95,
  },
  {
    id: 'supermarket:penny',
    category: 'groceries',
    match: (m, t) => m.includes('PENNY') || t.includes('PENNY'),
    defaultConfidence: 0.95,
  },
  {
    id: 'supermarket:kaufland',
    category: 'groceries',
    match: (m, t) => m.includes('KAUFLAND') || t.includes('KAUFLAND'),
    defaultConfidence: 0.95,
  },
  {
    id: 'supermarket:globus',
    category: 'groceries',
    match: (m, t) => m.includes('GLOBUS') || t.includes('GLOBUS'),
    defaultConfidence: 0.95,
  },
  {
    id: 'supermarket:familia',
    category: 'groceries',
    match: (m, t) => m.includes('FAMILA') || t.includes('FAMILA'),
    defaultConfidence: 0.95,
  },
  // Internal transfers (must come before Uber to avoid false positives)
  // Note: "Übertragung" normalizes to "UBERTRAGUNG" (not "UEBERTRAGUNG")
  {
    id: 'internal:transfer',
    category: 'internal:own-account',
    match: (m, t) =>
      t.includes('EIGENE UBERTRAGUNG') ||
      t.includes('INTERN') ||
      t.includes('UMBUCHUNG'),
    defaultConfidence: 0.95,
  },
  // Uber subscriptions (Uber One, Uber Pass) – must come before Eats and trip rules
  {
    id: 'subscriptions:uber',
    category: 'subscriptions',
    match: (m, t) => {
      const merchant = m ?? '';
      const text = t ?? '';
      const haystack = (merchant + ' ' + text).toUpperCase();
      
      // Must be Uber
      if (!haystack.includes('UBER')) return false;
      
      // Exclude Eats (Eats is food delivery, not subscription)
      if (haystack.includes('EATS') || haystack.includes('PAYMENTS BV')) return false;
      
      // Exclude ride trips (explicit trip indicators)
      if (haystack.includes('UBER TRIP') || haystack.includes('HELP.UBER.COM') || haystack.includes('HELPUBER.COM')) {
        return false;
      }
      
      // Subscription signals: explicit keywords OR "Uber BV" in PayPal context with "Ihr Einkauf bei"
      // "Uber BV" (not "Uber Payments BV") in PayPal transactions with "Ihr Einkauf bei Uber BV" is typically the subscription entity
      const hasSubscriptionKeywords = isUberSubscriptionLike(haystack);
      const isUberBVInPayPal = haystack.includes('UBER BV') && 
                                !haystack.includes('PAYMENTS') && 
                                haystack.includes('PAYPAL') &&
                                haystack.includes('IHR EINKAUF BEI UBER BV');
      
      return hasSubscriptionKeywords || isUberBVInPayPal;
    },
    defaultConfidence: 0.9,
  },
  // Uber Eats – food delivery (must come before generic Uber rule)
  {
    id: 'dining:uber-eats',
    category: 'dining:delivery',
    match: (m, t) => {
      const merchant = m ?? '';
      const text = t ?? '';
      const haystack = (merchant + ' ' + text).toUpperCase();
      
      // 🚫 Never treat subscription-like charges as Eats
      if (isUberSubscriptionLike(haystack)) return false;
      
      // Strong Uber Eats signals
      // "Uber Payments BV" (not just "Uber BV") is the Eats entity
      return haystack.includes('UBER') && 
             (haystack.includes('EATS') || 
              haystack.includes('HELPEUBER.COM') ||
              haystack.includes('UBER PAYMENTS BV'));
    },
    defaultConfidence: 0.95,
  },
  // Uber rideshare trips (but not Eats or subscriptions)
  {
    id: 'transport:uber-trip',
    category: 'transport:rideshare',
    match: (m, t) => {
      const merchant = m ?? '';
      const text = t ?? '';
      const haystack = (merchant + ' ' + text).toUpperCase();

      if (isGenericBankTransfer(haystack)) return false;
      
      // 🚫 Never treat subscription-like charges as trips
      if (isUberSubscriptionLike(haystack)) return false;
      
      // First check if it's a transfer - if so, exclude
      // Note: "Übertragung" normalizes to "UBERTRAGUNG"
      const isTransfer = text.includes('UBERTRAGUNG') || 
                         text.includes('UEBERTRAGUNG') ||
                         text.includes('ÜBERWEISUNG') ||
                         text.includes('UEBERWEISUNG') ||
                         text.includes('INTERN') || 
                         text.includes('UMBUCHUNG') ||
                         text.includes('INSTANT TRANSFER') ||
                         merchant.includes('UBERTRAGUNG') ||
                         merchant.includes('PAYPAL'); // PayPal transfers often contain "Uber" in merchant name
      if (isTransfer) return false;
      
      // Must be Uber, but NOT Eats
      if (!haystack.includes('UBER')) return false;
      if (haystack.includes('EATS') || haystack.includes('HELPEUBER.COM')) return false;
      
      // Uber trip indicators
      return haystack.includes('UBER') || 
             haystack.includes('HELP.UBER.COM') ||
             haystack.includes('HELPUBER.COM');
    },
    defaultConfidence: 0.9,
  },
  // Streaming subscriptions – Netflix, Spotify, etc.
  {
    id: 'subscriptions:streaming',
    category: 'subscriptions:streaming',
    match: (m, t) =>
      m.includes('NETFLIX') ||
      m.includes('SPOTIFY') ||
      m.includes('DISNEY') ||
      t.includes('NETFLIX') ||
      t.includes('SPOTIFY') ||
      t.includes('DISNEY'),
    defaultConfidence: 0.9,
  },
  // Software subscriptions – OpenAI, Cursor, etc.
  {
    id: 'subscriptions:software:openai',
    category: 'subscriptions:software',
    match: (m, t) =>
      m.includes('OPENAI') ||
      t.includes('OPENAI') ||
      t.includes('OPENAI IRELAND'),
    defaultConfidence: 0.9,
  },
  {
    id: 'subscription:cursor',
    category: 'subscriptions:software',
    match: (m, t) =>
      m.includes('CURSOR') ||
      t.includes('CURSOR') ||
      t.includes('CURSOR AI POWERED IDE') ||
      t.includes('CURSOR.COM'),
    defaultConfidence: 0.95,
  },
  // Deutsche Bahn / ÖPNV
  {
    id: 'transport:db',
    category: 'transport:public',
    match: (m, t) =>
      !isGenericBankTransfer((m ?? '') + ' ' + (t ?? '')) && (
      m.includes('DEUTSCHE BAHN') ||
      t.includes('DEUTSCHE BAHN') ||
      (m.includes('DB ') && !m.includes('DBANK')) ||
      (t.includes('DB ') && !t.includes('DBANK')) ||
      t.includes('ÖPNV')),
    defaultConfidence: 0.9,
  },
  // Salary / wages
  {
    id: 'income:salary',
    category: 'income:salary',
    match: (m, t) =>
      t.includes('GEHALT') ||
      t.includes('LOHN') ||
      t.includes('VERGÜTUNG') ||
      t.includes('VERGUETUNG') ||
      t.includes('PAYROLL') ||
      t.includes('SALARY'),
    defaultConfidence: 1.0,
  },
  // Bank fees
  {
    id: 'fees:bank',
    category: 'fees:bank',
    match: (m, t) =>
      t.includes('KONTOFÜHRUNGSGEBÜHR') ||
      t.includes('KONTOFUEHRUNGSGEBUEHR') ||
      t.includes('ÜBERWEISUNGSGEBÜHR') ||
      t.includes('UEBERWEISUNGSGEBUEHR') ||
      t.includes('SEPA GEBÜHR') ||
      t.includes('SEPA GEBUEHR') ||
      t.includes('KARTENENTGELT') ||
      t.includes('KARTENGEBÜHR') ||
      t.includes('KARTENGEBUEHR') ||
      t.includes('KONTOFÜHRUNG') ||
      t.includes('KONTOPREIS') ||
      t.includes('ENTGELT') ||
      t.includes('GEBÜHR'),
    defaultConfidence: 0.8,
  },
  // Telco cluster (DRILLISCH, O2, VODAFONE, TELEKOM, 1&1) → subscriptions:telecom
  {
    id: 'telco:drillisch',
    category: 'subscriptions:telecom',
    match: (m, t) => m.includes('DRILLISCH') || t.includes('DRILLISCH') || t.includes('DRILLISCH ONLINE'),
    defaultConfidence: 0.95,
  },
  {
    id: 'telco:o2',
    category: 'subscriptions:telecom',
    match: (m, t) => {
      // Match O2 telecom but avoid false positives
      return m.includes('O2') || 
             t.includes('O2 TELEFONICA') || 
             t.includes('O2 DE') ||
             (t.includes('O2') && (t.includes('TELEFONICA') || t.includes('MOBIL')));
    },
    defaultConfidence: 0.9,
  },
  {
    id: 'telco:vodafone',
    category: 'subscriptions:telecom',
    match: (m, t) => m.includes('VODAFONE') || t.includes('VODAFONE') || t.includes('VODAFONE DEUTSCHLAND'),
    defaultConfidence: 0.9,
  },
  {
    id: 'telco:telekom',
    category: 'subscriptions:telecom',
    match: (m, t) => m.includes('TELEKOM') || t.includes('TELEKOM') || t.includes('DEUTSCHE TELEKOM') || t.includes('T-MOBILE'),
    defaultConfidence: 0.9,
  },
  {
    id: 'telco:1and1',
    category: 'subscriptions:telecom',
    match: (m, t) => m.includes('1&1') || t.includes('1&1') || t.includes('1 & 1') || t.includes('1UND1'),
    defaultConfidence: 0.9,
  },
  // PayPal with restaurant merchant detection (e.g., "PAYPAL *MEZIS PIZZA", "PAYPAL ... Mezis Pizza")
  // This must come BEFORE the generic PayPal rule to catch restaurant transactions first
  {
    id: 'payment:paypal:restaurant',
    category: 'dining',
    match: (m, t) => {
      if (!t.includes('PAYPAL')) return false;
      // Check for restaurant keywords in the transaction text
      const restaurantKeywords = ['PIZZA', 'RESTAURANT', 'CAFE', 'BURGER', 'DONER', 'KEBAB', 'IMBISS', 'MEZIS'];
      return restaurantKeywords.some(keyword => t.includes(keyword));
    },
    defaultConfidence: 0.8,
  },
  // PayPal - handle carefully to avoid false positives
  {
    id: 'payment:paypal',
    category: 'fees:service',
    match: (m, t) => {
      // PayPal as payment processor - check if it's a transfer or actual payment
      const isTransfer = t.includes('UBERTRAGUNG') || t.includes('UEBERTRAGUNG') || 
                         t.includes('ÜBERWEISUNG') || t.includes('UEBERWEISUNG') ||
                         t.includes('INSTANT TRANSFER') || t.includes('INTERN') ||
                         t.includes('EIGENE UBERTRAGUNG');
      if (isTransfer) return false;
      
      // Check for PayPal merchant name patterns (PayPal Europe S.a r.l. et Cie, S.C.A)
      return (m.includes('PAYPAL') || t.includes('PAYPAL')) && 
             (t.includes('PAYPAL EUROPE') || t.includes('PAYPAL *') || t.includes('PAYPAL.COM') ||
              t.includes('PAYPAL S.A') || t.includes('PAYPAL S.A R.L') || 
              t.includes('PAYPAL EUROPE S.A R.L ET CIE') ||
              t.includes('PAYPAL EUROPE S.A R.L ET CIE S.C.A'));
    },
    defaultConfidence: 0.7, // Lower confidence as PayPal is often just a payment method
  },
  // Housing / Rent keywords
  {
    id: 'housing:rent',
    category: 'housing:rent',
    match: (m, t) =>
      t.includes('MIETE') ||
      t.includes('KALTMIETE') ||
      t.includes('WARMMIETE') ||
      t.includes('MIETZAHLUNG') ||
      t.includes('RENT') ||
      t.includes('MIETVERTRAG'),
    defaultConfidence: 0.95,
  },
  // Dining - Bakeries
  {
    id: 'dining:bakery_generic',
    category: 'dining:bakery',
    match: (m, t) =>
      t.includes('BAECKEREI') ||
      t.includes('BÄCKEREI') ||
      t.includes('BACKEREI') ||
      t.includes('BAKERY') ||
      m.includes('BAECKEREI') ||
      m.includes('BÄCKEREI') ||
      m.includes('BACKEREI') ||
      m.includes('BAKERY') ||
      m.includes('HEINEMANN'),
    defaultConfidence: 0.9,
  },
  // Shopping - Metro Markets
  {
    id: 'shopping:metro_markets',
    category: 'shopping:home_improvement',
    match: (m, t) =>
      ((m.includes('METRO') || t.includes('METRO')) &&
       (t.includes('MARKETS') || t.includes('MA RKETS') || t.includes('CASH & CARRY'))) ||
      m.includes('METRO MARKETS GMBH') ||
      m.includes('METRO CASH & CARRY'),
    defaultConfidence: 0.9,
  },
  // Health - Teleclinic
  {
    id: 'health:teleclinic',
    category: 'health:medical',
    match: (m, t) =>
      m.includes('TELECLINIC') ||
      t.includes('TELECLINIC') ||
      t.includes('TELE CLINIC') ||
      m.includes('TELE CLINIC') ||
      m.includes('TELECLINIC GMBH'),
    defaultConfidence: 0.95,
  },
  // Insurance - Europ Assistance
  {
    id: 'insurance:europ_assistance',
    category: 'insurance:travel',
    match: (m, t) =>
      t.includes('EUROP ASSISTANCE') ||
      m.includes('EUROP ASSISTANCE') ||
      t.includes('EUROP ASSISTANCE PARIS FR'),
    defaultConfidence: 0.95,
  },
  // Travel - Natuurhuisje
  {
    id: 'travel:natuurhuisje',
    category: 'travel:holiday',
    match: (m, t) =>
      t.includes('NATUURHUISJE') ||
      m.includes('NATUURHUISJE') ||
      t.includes('NATURHUISJE') ||
      m.includes('NATURHUISJE') ||
      t.includes('WWW.NATUURHUISJE.NL'),
    defaultConfidence: 0.95,
  },
];

// ============================================================================
// Public API: applyRules (simple merchant/text matching)
// ============================================================================

/**
 * Public API: Result of applying categorization rules.
 */
export interface RuleHit {
  category: CategoryId;
  source: 'rule' | 'user' | 'ml';
  ruleId: string;
  confidence: number;
  merchantName?: string;
  matchedText?: string;
}

/**
 * Public API: Apply categorization rules to a merchant name and raw text.
 * 
 * This is the main entry point expected by tests/rules.spec.ts and tests/categorization-v1.spec.ts.
 * 
 * @param merchant - Merchant name (can be null/undefined)
 * @param rawText - Raw transaction text (can be null/undefined)
 * @returns RuleHit if a rule matches, null otherwise
 */
export function applyRules(
  merchant: string | null | undefined,
  rawText: string | null | undefined,
): RuleHit | null {
  const merchantNorm = normalize(merchant);
  const textNorm = normalize(rawText);

  for (const rule of SYSTEM_RULES_CONFIG) {
    if (rule.match(merchantNorm, textNorm)) {
      // Map NimbusCategoryId to CategoryId if needed (will be handled by mapNimbusCategoryToLegacy later)
      const category = typeof rule.category === 'string' ? (rule.category as CategoryId) : rule.category;
      return {
        category: category as CategoryId, // Cast for compatibility - actual mapping happens in engine
        source: rule.source ?? 'rule',
        ruleId: rule.id,
        confidence: rule.defaultConfidence ?? 0.8,
        merchantName: merchant ?? undefined,
        matchedText: rawText ?? undefined,
      };
    }
  }

  // No match → keep previous behaviour that tests expect:
  // - rules.spec.ts expects null when nothing matches
  return null;
}

// ============================================================================
// Internal API: applyRulesForRow (advanced rule matching with CategoryRule)
// ============================================================================

/**
 * Internal API: Apply rules to a ParsedRow with support for user rules.
 * This is used by the categorization engine.
 */
export interface ApplyRulesResult {
  categoryId: string | null;
  categorySource: 'rule' | 'fallback';
  merchantName?: string;
  confidence?: number;
}

/**
 * Build a description string from a ParsedRow by combining candidate fields.
 */
function buildDescription(row: ParsedRow): string {
  const candidates: string[] = [];
  
  if (typeof row.normalizedText === 'string' && row.normalizedText.trim().length > 0) {
    candidates.push(row.normalizedText);
  }
  if (row.rawText?.trim()) {
    candidates.push(row.rawText);
  }
  if (row.reference?.trim()) {
    candidates.push(row.reference);
  }
  if (row.counterparty?.trim()) {
    candidates.push(row.counterparty);
  }
  
  let base = candidates.join(' ').trim();
  if (!base && typeof row.raw?.description === 'string') {
    base = row.raw.description as string;
  }
  
  return base;
}

/**
 * Evaluate whether a rule matches a transaction row.
 */
function evaluateRule(
  rule: CategoryRule,
  row: ParsedRow,
  normalizedDescription: string,
): boolean {
  if (!rule.enabled) return false;
  
  const when = rule.when;
  
  // Check direction
  if (when.direction && when.direction !== row.direction) {
    return false;
  }
  
  // Check contains: at least one token must be found in normalizedDescription
  if (when.contains && when.contains.length > 0) {
    const normalizedTokens = when.contains.map(token => normalizeForMatch(token));
    const hasMatch = normalizedTokens.some(token => 
      normalizedDescription.includes(token)
    );
    if (!hasMatch) return false;
  }
  
  // Check regex: safe try/catch around new RegExp, case-insensitive
  if (when.regex) {
    try {
      const regex = new RegExp(when.regex, 'i');
      if (!regex.test(normalizedDescription)) return false;
    } catch {
      return false;
    }
  }
  
  // Check ibanEquals: match against row.counterpartyIban (normalized uppercase)
  if (when.ibanEquals) {
    const expected = when.ibanEquals.toUpperCase().replace(/\s/g, '');
    const counterpartyIban = row.counterpartyIban?.toUpperCase().replace(/\s/g, '');
    if (!counterpartyIban || counterpartyIban !== expected) return false;
  }
  
  // Check mccIn: check row.mcc if available
  if (when.mccIn && when.mccIn.length > 0) {
    const mcc = row.mcc?.toUpperCase();
    const allowed = when.mccIn.map(code => code.toUpperCase());
    if (!mcc || !allowed.includes(mcc)) return false;
  }
  
  // Check merchantEquals: match against row.counterparty or normalized merchant
  if (when.merchantEquals) {
    const expected = normalizeForMatch(when.merchantEquals);
    const candidateMerchant = row.counterparty 
      ? normalizeForMatch(row.counterparty)
      : undefined;
    if (!candidateMerchant || candidateMerchant !== expected) return false;
  }
  
  // Check minAmountAbs / maxAmountAbs: compared to Math.abs(row.amountCents)
  if (typeof when.minAmountAbs === 'number') {
    if (Math.abs(row.amountCents) < when.minAmountAbs) return false;
  }
  if (typeof when.maxAmountAbs === 'number') {
    if (Math.abs(row.amountCents) > when.maxAmountAbs) return false;
  }
  
  return true;
}

/**
 * Score to confidence mapping.
 */
function scoreToConfidence(score: number): number {
  if (score >= 220) return 1.0;
  if (score >= 180) return 0.9;
  if (score >= 150) return 0.8;
  return Math.min(0.7, Math.max(0.4, score / 200));
}

/**
 * System rules that are built-in and always available.
 * These are comprehensive German examples for common merchants/categories.
 * Used by applyRulesForRow for advanced rule matching.
 */
export const SYSTEM_RULES: CategoryRule[] = [
  {
    id: 'income_salary_keywords',
    source: 'system',
    enabled: true,
    score: 220,
    setCategory: 'income:salary',
    when: { direction: 'in', contains: ['GEHALT', 'LOHN', 'VERGÜTUNG', 'VERGUETUNG', 'PAYROLL', 'SALARY'] },
  },
  {
    id: 'groceries_supermarket_keywords',
    source: 'system',
    enabled: true,
    score: 200,
    setCategory: 'groceries',
    when: { direction: 'out', contains: ['REWE', 'EDEKA', 'ALDI', 'LIDL', 'NETTO', 'PENNY'] },
  },
  {
    id: 'transport_public_keywords',
    source: 'system',
    enabled: true,
    score: 200,
    setCategory: 'transport:public',
    when: { direction: 'out', contains: ['DEUTSCHE BAHN', 'DB FERNVERKEHR', 'KVB', 'BVG', 'MVV', 'VVS'] },
  },
  {
    id: 'subscriptions_telecom_keywords',
    source: 'system',
    enabled: true,
    score: 200,
    setCategory: 'subscriptions:telecom',
    when: { direction: 'out', contains: ['HANDY', 'MOBILFUNK', 'TELEKOM', 'DRILLISCH', 'VODAFONE', 'O2 TELEFONICA'] },
  },
  {
    id: 'internal_transfer_keywords',
    source: 'system',
    enabled: true,
    score: 200,
    setCategory: 'internal:savings',
    when: { direction: 'out', contains: ['SPARKONTO', 'TAGESGELD'] },
  },
  {
    id: 'charity_keywords',
    source: 'system',
    enabled: true,
    score: 160,
    setCategory: 'charity',
    when: { direction: 'out', contains: ['SPENDE', 'DONATION', 'CHARITY'] },
  },
];

/**
 * Internal API: Apply categorization rules to a transaction row with support for user rules.
 * This is used by the categorization engine for more advanced rule matching.
 * 
 * @param row - The parsed transaction row to categorize
 * @param opts - Optional rules and patterns to use (defaults to system rules only)
 * @returns The categorization result
 */
export function applyRulesForRow(
  row: ParsedRow,
  opts?: {
    systemRules?: CategoryRule[];
    userRules?: CategoryRule[];
    merchantPatterns?: MerchantPattern[];
  },
): ApplyRulesResult {
  // Build normalized description for matching
  const description = buildDescription(row);
  const normalizedDescription = normalizeForMatch(description);
  
  // Combine rules: user rules should have higher precedence at same score
  const systemRules = opts?.systemRules ?? SYSTEM_RULES;
  const userRules = opts?.userRules ?? [];
  const allRules: CategoryRule[] = [...userRules, ...systemRules];
  
  // Evaluate all rules and collect matches
  type RuleMatch = {
    rule: CategoryRule;
    categoryId: string;
    score: number;
    source: 'rule';
  };
  
  const matches: RuleMatch[] = [];
  
  for (const rule of allRules) {
    if (evaluateRule(rule, row, normalizedDescription)) {
      matches.push({
        rule,
        categoryId: rule.setCategory,
        score: rule.score,
        source: 'rule',
      });
    }
  }
  
  // If no matches, return fallback
  if (matches.length === 0) {
    return {
      categoryId: null,
      categorySource: 'fallback',
      merchantName: row.counterparty ?? undefined,
      confidence: 0.1,
    };
  }
  
  // Sort by score (descending), then pick the highest
  matches.sort((a, b) => b.score - a.score);
  const bestMatch = matches[0];
  
  return {
    categoryId: bestMatch.categoryId,
    categorySource: 'rule',
    merchantName: row.counterparty ?? undefined,
    confidence: scoreToConfidence(bestMatch.score),
  };
}

// ============================================================================
// Legacy API: applyBasicRules (uses JSON rules)
// ============================================================================

/**
 * Legacy basic rules function
 */
export type Rule = {
  if: {
    merchant?: string[];
    textContains?: string[];
  };
  category: string;
};

export type RuleHitLegacy = {
  category: string;
  source: 'rule';
};

const BASIC_RULES = rawRules as Rule[];

/**
 * Legacy basic rules function - uses legacyRules.json for simple merchant/text matching.
 * 
 * @param merchant - Merchant name (optional)
 * @param rawText - Raw transaction text
 * @returns RuleHitLegacy if a rule matches, null otherwise
 */
export function applyBasicRules(merchant: string | undefined, rawText: string): RuleHitLegacy | null {
  const haystack = (rawText || '').toLowerCase();

  for (const rule of BASIC_RULES) {
    let matches = true;

    if (rule.if.merchant && rule.if.merchant.length > 0) {
      matches = matches && !!merchant && rule.if.merchant.includes(merchant);
    }

    if (matches && rule.if.textContains && rule.if.textContains.length > 0) {
      matches = rule.if.textContains.some(token => haystack.includes(token.toLowerCase()));
    }

    // Special handling for Uber rules: exclude subscription keywords
    // This prevents "UBER PASS Membership" from matching the generic "UBER" merchant rule
    // Build combined haystack to check subscription keywords in both merchant and text
    if (matches && rule.category === 'transport:rideshare' && 
        merchant && merchant.toUpperCase().includes('UBER')) {
      const combinedHaystack = `${merchant ?? ''} ${rawText ?? ''}`.toUpperCase();
      if (isUberSubscriptionLike(combinedHaystack)) {
        continue; // Skip this rule match - subscription will be handled by heuristic
      }
    }

    if (matches) {
      return { category: rule.category, source: 'rule' };
    }
  }

  return null;
}

// ============================================================================
// Module Load Verification
// ============================================================================

// Module-level verification: ensure functions are exported correctly
// This runs at module load time to catch export issues early
if (typeof module !== 'undefined' && module.exports) {
  // Verify exports are functions (will be checked at runtime)
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log('[categorization/rulesRuntime] Module loaded: applyRulesForRow and applyBasicRules exported');
  }
}

