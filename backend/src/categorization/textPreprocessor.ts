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
 * Also handles German bank export formats where PayPal appears in counterpartName
 * but the underlying merchant is in purpose/memo fields.
 */
export function extractUnderlyingMerchantFromPayPal(rawText: string): string | null {
  if (!rawText) return null;
  const upper = rawText.toUpperCase();
  
  // Pattern 1: PAYPAL *MERCHANT (most common pattern)
  // Matches: "PAYPAL *ARAL STATION 123", "PAYPAL*MERCHANT", "PAYPAL * MERCHANT"
  const starMatch = upper.match(/PAYPAL\s*\*\s*([A-Z0-9\s\-\.]+?)(?:\s*\||\s*$|(?=\s+[A-Z]+\s+\|))/);
  if (starMatch && starMatch[1]) {
    const merchant = starMatch[1].trim();
    // Filter out common noise words that sometimes appear after merchant
    const cleanMerchant = merchant.replace(/\s+(STATION|SHOP|STORE|MARKT|CAFE|CAFE|RESTAURANT)\s*$/i, '').trim();
    if (cleanMerchant.length >= 3) {
      return cleanMerchant;
    }
    return merchant.trim();
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
  
  // Pattern 4: Merchant appears after PayPal in purpose text
  // Example: "Lastschrift ... PayPal ... ARAL STATION ..."
  // This handles cases where merchant might be separated by other text
  const afterPaypal = upper.match(/PAYPAL[^A-Z]*?([A-Z]{2,}(?:\s+[A-Z0-9]{2,}){1,3})(?:\s+STATION|\s+SHOP|\s+CAFE|\s+MARKT|$)/);
  if (afterPaypal && afterPaypal[1]) {
    const merchant = afterPaypal[1].trim();
    // Filter out common false positives (e.g., "EUROPE", "S.A.R.L", "ET CIE")
    const falsePositives = /^(EUROPE|S\.A\.R\.L|ET|CIE|S\.C\.A|LASTSCHRIFT|BELASTUNG|AUFTRAGGEBER|PAYPAL)/i;
    if (!falsePositives.test(merchant) && merchant.length >= 3) {
      return merchant;
    }
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
