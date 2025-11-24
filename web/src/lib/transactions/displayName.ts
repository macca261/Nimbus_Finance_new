/**
 * Centralized helper to get a user-friendly display name for a transaction.
 * 
 * Priority order:
 * 1. displayName (if provided by backend/parser)
 * 2. payee (merchant/recipient name)
 * 3. counterpartName (counterparty name)
 * 4. merchant (alternative merchant field)
 * 5. Fallback: cleaned/shortened rawText (removes technical prefixes)
 * 
 * This ensures user-facing lists show short, friendly names instead of
 * raw booking text with reference numbers and technical phrases.
 * 
 * @param tx - Transaction object with optional displayName, payee, counterpartName, merchant, rawText fields
 * @returns User-friendly display name, or '—' if no name available
 */
export function getTransactionDisplayName(tx: {
  displayName?: string | null;
  payee?: string | null;
  counterpartName?: string | null;
  counterpart?: string | null;
  merchant?: string | null;
  rawText?: string | null;
  purpose?: string | null;
  memo?: string | null;
  categoryExplanation?: {
    merchantName?: string | null;
  } | null;
}): string {
  // Priority 1: displayName (computed by backend/parser)
  if (tx.displayName && tx.displayName.trim()) {
    return tx.displayName.trim();
  }

  // Priority 2: payee (merchant/recipient name)
  if (tx.payee && tx.payee.trim()) {
    return tx.payee.trim();
  }

  // Priority 3: counterpartName or counterpart
  if (tx.counterpartName && tx.counterpartName.trim()) {
    return tx.counterpartName.trim();
  }
  if (tx.counterpart && tx.counterpart.trim()) {
    return tx.counterpart.trim();
  }

  // Priority 4: merchant field
  if (tx.merchant && tx.merchant.trim()) {
    return tx.merchant.trim();
  }

  // Priority 5: categoryExplanation.merchantName (extracted by categorization)
  if (tx.categoryExplanation?.merchantName && tx.categoryExplanation.merchantName.trim()) {
    return tx.categoryExplanation.merchantName.trim();
  }

  // Priority 6: Fallback to cleaned rawText (remove technical prefixes)
  const rawText = tx.rawText || tx.purpose || tx.memo || '';
  if (rawText.trim()) {
    return cleanRawText(rawText.trim());
  }

  return '—';
}

/**
 * Clean raw booking text by removing common technical prefixes and trimming.
 * Examples:
 * - "Kartenzahlung | Buchungstext: NETFLIX" -> "NETFLIX"
 * - "Überweisung | Empfänger: Amazon" -> "Amazon"
 * - "Lastschrift | Verwendungszweck: Spotify" -> "Spotify"
 */
function cleanRawText(text: string): string {
  // Remove common prefixes (case-insensitive)
  const cleaned = text
    // Remove "Kartenzahlung | Buchungstext:" pattern
    .replace(/^Kartenzahlung\s*\|\s*Buchungstext:\s*/i, '')
    // Remove "Überweisung | Empfänger:" pattern
    .replace(/^Überweisung\s*\|\s*Empfänger:\s*/i, '')
    // Remove "Lastschrift | Verwendungszweck:" pattern
    .replace(/^Lastschrift\s*\|\s*Verwendungszweck:\s*/i, '')
    // Remove "Dauerauftrag | Empfänger:" pattern
    .replace(/^Dauerauftrag\s*\|\s*Empfänger:\s*/i, '')
    // Remove "SEPA | " pattern
    .replace(/^SEPA\s*\|\s*/i, '')
    // Remove generic "Buchungstext:" prefix
    .replace(/^Buchungstext:\s*/i, '')
    // Remove generic "Verwendungszweck:" prefix
    .replace(/^Verwendungszweck:\s*/i, '')
    // Remove generic "Empfänger:" prefix
    .replace(/^Empfänger:\s*/i, '')
    // Remove pipe-separated prefixes (common pattern: "TYPE | DETAILS")
    .replace(/^[^|]+\s*\|\s*/, '')
    // Trim whitespace
    .trim();

  // If cleaning resulted in empty string, return original (truncated)
  if (!cleaned) {
    // Return first 50 chars of original, or full if shorter
    return text.length > 50 ? text.substring(0, 50) + '…' : text;
  }

  // Return cleaned text (truncate if very long)
  return cleaned.length > 60 ? cleaned.substring(0, 60) + '…' : cleaned;
}

