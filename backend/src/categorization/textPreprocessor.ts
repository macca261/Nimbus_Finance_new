/**
 * Extract and strip bank reference IDs from transaction text.
 * 
 * Matches patterns like:
 * - "Ref. 6P2C21RY16B438RD/48368"
 * - "Ref 6P2C21RY16B438RD/48368"
 * - "REF. 6P2C21RY16B438RD/48368"
 * 
 * @param rawText - The original transaction text
 * @returns Object with cleaned text and extracted bank reference ID
 */
export function stripBankReference(
  rawText: string,
): { cleanText: string; bankReferenceId?: string | null } {
  // Matches e.g. "Ref. 6P2C21RY16B438RD/48368" (case-insensitive)
  // Pattern: "Ref" (optional period) whitespace, then alphanumeric/slash/dash sequence
  const refRegex = /\bRef\.?\s+([A-Z0-9\/\-]+)\b/i;
  
  const match = rawText.match(refRegex);
  if (!match) {
    return { cleanText: rawText, bankReferenceId: null };
  }
  
  const bankRef = match[1];
  // Remove the reference pattern and clean up extra whitespace
  const cleanText = rawText.replace(refRegex, '').replace(/\s{2,}/g, ' ').trim();
  
  return { cleanText, bankReferenceId: bankRef };
}

/**
 * Extract underlying merchant from PayPal transaction text.
 * PayPal transactions often have format: "PAYPAL *MERCHANT NAME"
 */
export function extractUnderlyingMerchantFromPayPal(rawText: string): string | null {
  if (!rawText) return null;
  const upper = rawText.toUpperCase();
  // Pattern 1: PAYPAL *MERCHANT
  const starMatch = upper.match(/PAYPAL\s*\*\s*([A-Z0-9\s\-]+)/);
  if (starMatch && starMatch[1]) {
    return starMatch[1].trim();
  }
  // Pattern 2: "Ihr Einkauf bei <Merchant>" with Uber variants
  const einkaufBei = upper.match(/IHR\s+EINKAUF\s+BEI\s+([A-Z\s\.]*?UBER\s*(?:PAYMENTS\s*)?BV)/);
  if (einkaufBei && einkaufBei[1]) {
    return einkaufBei[1].trim();
  }
  // Pattern 3: direct mention of Uber BV/Payments BV in text
  const uber = upper.match(/UBER\s*(?:PAYMENTS\s*)?BV/);
  if (uber && uber[0]) {
    return uber[0].trim();
  }
  return null;
}

/**
 * Build text context for rule matching by combining relevant fields.
 */
export function buildRuleTextContext(row: { rawText?: string | null; counterparty?: string | null; reference?: string | null }): { cleanedText: string; merchantHint?: string } {
  const parts: string[] = [];
  if (row.rawText) parts.push(row.rawText);
  if (row.counterparty) parts.push(row.counterparty);
  if (row.reference) parts.push(row.reference);
  const combined = parts.join(' ').trim();
  
  // Extract merchant hint if available
  const merchantHint = row.counterparty || undefined;
  
  return { cleanedText: combined, merchantHint };
}
