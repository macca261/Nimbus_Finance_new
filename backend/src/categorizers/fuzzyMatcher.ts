/**
 * Fuzzy merchant matching layer for categorization.
 * 
 * This module provides fuzzy matching for merchant names to handle typos and variants.
 * It uses fast-fuzzy to match against a pre-built merchant index from merchants.json.
 */

import fs from 'node:fs';
import path from 'node:path';

// Try to import fast-fuzzy, fall back gracefully if not available
let fastFuzzySearch: any = null;
try {
  const fastFuzzy = require('fast-fuzzy');
  fastFuzzySearch = fastFuzzy.search || fastFuzzy.default?.search || fastFuzzy;
  if (typeof fastFuzzySearch !== 'function') {
    fastFuzzySearch = null;
  }
} catch {
  // fast-fuzzy not available, will use Levenshtein fallback
  fastFuzzySearch = null;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MIN_SCORE = 0.80;      // Tuned based on actual test scores (lowered to handle typos)
const DEFAULT_MAX_CANDIDATES = 3;

// ============================================================================
// Fallback: Levenshtein distance-based matching (only used if fast-fuzzy fails)
// ============================================================================

/**
 * Simple Levenshtein distance-based fuzzy matching (fallback when fast-fuzzy is not available).
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return matrix[len1][len2];
}

function similarityScore(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;
  const distance = levenshteinDistance(str1, str2);
  return 1 - (distance / maxLen);
}

// Track if we've logged a fallback warning (only log once)
let hasLoggedFallback = false;

// ============================================================================
// Types
// ============================================================================

export interface FuzzyMerchantCandidate {
  merchantId: string;          // internal ID from merchant DB
  canonicalName: string;     // normalized merchant name
  score: number;              // 0..1 similarity
  category: string;          // nimbus category string (e.g. 'groceries', 'transport:rideshare')
  source: 'merchant-db';     // so we can distinguish later
}

export interface FuzzyMatchOptions {
  minScore?: number;          // default DEFAULT_MIN_SCORE (0.83)
  maxCandidates?: number;     // default DEFAULT_MAX_CANDIDATES (3)
}

interface MerchantIndexEntry {
  id: string;
  normalizedName: string;
  category: string;
  canonicalName: string;      // original name for display
}

// ============================================================================
// Merchant Index Loading
// ============================================================================

/**
 * Normalize merchant name for fuzzy matching.
 * This is the canonical normalization function used for both index building and query matching.
 * - Lowercase
 * - Strip diacritics (ü → u, ß → ss)
 * - Remove common noise patterns
 * - Extract core merchant name (first meaningful word)
 */
function normalizeMerchantNameForFuzzy(input: string): string {
  if (!input || input.trim().length < 3) return '';
  
  let normalized = input.toLowerCase().trim();
  
  // Strip diacritics
  normalized = normalized
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ä/g, 'a')
    .replace(/ß/g, 'ss')
    .replace(/é/g, 'e')
    .replace(/è/g, 'e')
    .replace(/ê/g, 'e')
    .replace(/à/g, 'a')
    .replace(/á/g, 'a')
    .replace(/â/g, 'a')
    .replace(/ç/g, 'c');
  
  // Remove common noise patterns and extract core merchant name
  // Strategy: Extract meaningful words, filtering out noise but keeping merchant-specific terms
  const words = normalized.split(/\s+/);
  const coreWords: string[] = [];
  
  // Noise words that should be filtered out
  const noiseWords = new Set(['sagt', 'danke', 'gmbh', 'ag', 'limited', 'ltd', 'inc', 'corp', 'kg', 'co', 'eu', 's.a', 'r.l', 'et', 'cie', 's.c.a']);
  // Words that are part of merchant names (not noise) - these can appear after the merchant name
  const merchantTerms = new Set(['markt', 'city', 'online', 'fernverkehr', 'drogerie', 'bahnhof']);
  // Common location words that should stop extraction
  const locationWords = new Set(['hamburg', 'berlin', 'koeln', 'koln', 'muenchen', 'frankfurt', 'stuttgart', 'duesseldorf', 'dortmund', 'essen', 'leipzig', 'bochum', 'dresden', 'hannover', 'nuernberg', 'deutschland', 'germany']);
  
  for (const word of words) {
    const cleanWord = word.replace(/[.,;:]/g, ''); // Remove punctuation
    if (cleanWord.length >= 2 && 
        !noiseWords.has(cleanWord) &&
        !/^\d{5,}$/.test(cleanWord)) {
      // Stop if we hit a location word (unless it's part of merchant name like "deutsche bahn")
      if (locationWords.has(cleanWord) && coreWords.length > 0) {
        break;
      }
      coreWords.push(cleanWord);
      // Keep first 2-3 words for multi-word merchant names (e.g., "deutsche bahn", "dm drogerie")
      // But stop after merchant name + one modifier (e.g., "rewe markt" not "rewe markt koln")
      if (coreWords.length >= 2 && !merchantTerms.has(cleanWord) && locationWords.has(cleanWord)) {
        // If we have 2+ words and current word is a location, stop
        coreWords.pop(); // Remove the location word
        break;
      }
      if (coreWords.length >= 3) break;
    }
  }
  
  // Use core words if available, otherwise fall back to cleaned normalized string
  if (coreWords.length > 0) {
    normalized = coreWords.join(' ');
  } else {
    // Fallback: remove noise patterns from original
    normalized = normalized
      .replace(/\bsagt\s+danke\b/gi, ' ')
      .replace(/\bmarkt\b/gi, ' ')
      .replace(/\bgmbh\b/gi, ' ')
      .replace(/\bag\b/gi, ' ')
      .replace(/\blimited\b/gi, ' ')
      .replace(/\bltd\b/gi, ' ')
      .replace(/\binc\b/gi, ' ')
      .replace(/\bcorp\b/gi, ' ')
      .replace(/\bs\.a\.r\.l\.\b/gi, ' ')
      .replace(/\bet\s+cie\s+s\.c\.a\.?\b/gi, ' ')
      .replace(/\beu\s+s\.a\s+r\.l\b/gi, ' ')
      .replace(/\bco\.\s+kg\b/gi, ' ')
      .replace(/\b\d{5,}\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  return normalized;
}

/**
 * Load and build merchant index from merchants.json.
 * This is computed once at module load for performance.
 */
let merchantIndex: MerchantIndexEntry[] | null = null;

function loadMerchantIndex(): MerchantIndexEntry[] {
  if (merchantIndex !== null) {
    return merchantIndex;
  }

  merchantIndex = [];
  
  try {
    // Try multiple paths to handle both dev and build modes
    let merchantsJsonPath: string | null = null;
    
    // In build mode, __dirname points to dist/categorizers
    // In dev mode, __dirname points to src/categorizers
    const dirnamePath = path.join(__dirname, '..', '..', 'data', 'merchants.json');
    if (fs.existsSync(dirnamePath)) {
      merchantsJsonPath = dirnamePath;
    } else {
      // Fallback: try relative to process.cwd()
      const cwdPath = path.join(process.cwd(), 'data', 'merchants.json');
      if (fs.existsSync(cwdPath)) {
        merchantsJsonPath = cwdPath;
      }
    }
    
    if (!merchantsJsonPath) {
      console.warn('[fuzzyMatcher] merchants.json not found, fuzzy matching disabled');
      return [];
    }
    
    const merchantsContent = fs.readFileSync(merchantsJsonPath, 'utf-8');
    const merchantsData = JSON.parse(merchantsContent) as {
      merchants: Array<{
        id: string;
        names: string[];
        mainCategoryId?: string;
        subCategoryId?: string;
        category?: string;
      }>;
    };
    
    // Build index from all merchant names
    for (const merchant of merchantsData.merchants) {
      const category = merchant.mainCategoryId || merchant.category || 'other';
      const canonicalName = merchant.names[0] || merchant.id; // Use first name as canonical
      
      // Add each name variant to the index
      for (const name of merchant.names) {
        const normalizedName = normalizeMerchantNameForFuzzy(name);
        if (normalizedName.length >= 3) {
          merchantIndex.push({
            id: merchant.id,
            normalizedName,
            category,
            canonicalName,
          });
        }
      }
    }
    
    console.log(`[fuzzyMatcher] Loaded ${merchantIndex.length} merchant name variants from ${merchantsData.merchants.length} merchants`);
  } catch (err) {
    console.error('[fuzzyMatcher] Failed to load merchants.json:', err);
    merchantIndex = [];
  }
  
  return merchantIndex;
}

// Initialize index on module load
const MERCHANT_INDEX = loadMerchantIndex();

// ============================================================================
// Fuzzy Matching API
// ============================================================================

/**
 * Fuzzy match a merchant name against the merchant database.
 * 
 * @param merchantName - The merchant name to match (will be normalized)
 * @param opts - Matching options
 * @returns The best matching merchant candidate, or null if no good match
 */
export function fuzzyMatchMerchant(
  merchantName: string,
  opts: FuzzyMatchOptions = {},
): FuzzyMerchantCandidate | null {
  if (!merchantName || merchantName.trim().length < 3) {
    return null;
  }
  
  const minScore = opts.minScore ?? DEFAULT_MIN_SCORE;
  const maxCandidates = opts.maxCandidates ?? DEFAULT_MAX_CANDIDATES;
  
  if (MERCHANT_INDEX.length === 0) {
    return null; // No merchants loaded
  }
  
  // Normalize input using the same function as index building
  const normalizedInput = normalizeMerchantNameForFuzzy(merchantName);
  if (normalizedInput.length < 3) {
    return null;
  }
  
  // Primary: Use fast-fuzzy search if available
  if (fastFuzzySearch) {
    try {
      // fast-fuzzy v2.x API: search(query, items, options)
      const results = fastFuzzySearch(normalizedInput, MERCHANT_INDEX, {
        keySelector: (item: MerchantIndexEntry) => item.normalizedName,
        threshold: minScore,
        returnMatchData: true,
        limit: maxCandidates,
      });
      
      if (!results || results.length === 0) {
        return null;
      }
      
      // Get the best match
      // fast-fuzzy v2.x returns { item, score, match } objects
      const bestMatch = results[0];
      const matchData = bestMatch as { item: MerchantIndexEntry; score: number; match?: string };
      
      // fast-fuzzy returns scores as 0-1, verify it meets our threshold
      const score = matchData.score;
      if (score < minScore) {
        return null;
      }
      
    // Log score in test mode for debugging (temporary - remove after tuning)
    // if (process.env.NODE_ENV === 'test') {
    //   console.log('[fuzzy-test-score]', {
    //     input: merchantName,
    //     normalized: normalizedInput,
    //     matched: matchData.item.canonicalName,
    //     matchedNormalized: matchData.item.normalizedName,
    //     score: score.toFixed(3),
    //     method: 'fast-fuzzy',
    //   });
    // }
      
      return {
        merchantId: matchData.item.id,
        canonicalName: matchData.item.canonicalName,
        score,
        category: matchData.item.category,
        source: 'merchant-db',
      };
    } catch (err) {
      // Fallback: Levenshtein-based matching (only if fast-fuzzy fails)
      if (!hasLoggedFallback) {
        console.warn('[fuzzyMatcher] fast-fuzzy search failed, using Levenshtein fallback:', err);
        hasLoggedFallback = true; // Only log once
      }
      // Fall through to Levenshtein matching
    }
  }
  
  // Fallback: Levenshtein-based matching (used if fast-fuzzy not available or fails)
  let bestMatch: { entry: MerchantIndexEntry; score: number } | null = null;
  
  for (const entry of MERCHANT_INDEX) {
    const score = similarityScore(normalizedInput, entry.normalizedName);
    if (score >= minScore) {
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { entry, score };
      }
    }
  }
  
  if (!bestMatch) {
    return null;
  }
  
  // Log score in test mode for debugging (temporary - remove after tuning)
  // if (process.env.NODE_ENV === 'test') {
  //   console.log('[fuzzy-test-score]', {
  //     input: merchantName,
  //     normalized: normalizedInput,
  //     matched: bestMatch.entry.canonicalName,
  //     matchedNormalized: bestMatch.entry.normalizedName,
  //     score: bestMatch.score.toFixed(3),
  //     method: 'levenshtein',
  //   });
  // }
  
  return {
    merchantId: bestMatch.entry.id,
    canonicalName: bestMatch.entry.canonicalName,
    score: bestMatch.score,
    category: bestMatch.entry.category,
    source: 'merchant-db',
  };
}

