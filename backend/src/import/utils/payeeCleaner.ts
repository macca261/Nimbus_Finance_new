/**
 * Payee Cleaning Pipeline
 * 
 * Removes payment service provider prefixes, legal entity suffixes,
 * and normalizes whitespace to produce clean merchant names.
 */

/**
 * Clean payee name by removing PSP prefixes and legal entities
 * 
 * Examples:
 * - "PAYPAL *SPOTIFY S.A.R.L. 823409234" -> "Spotify"
 * - "SumUp *REWE" -> "REWE"
 * - "AMZN Mktp *Amazon" -> "Amazon"
 * - "Netflix GmbH" -> "Netflix"
 */
export function cleanPayee(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    return '';
  }

  return raw
    // Remove PSP prefixes (case-insensitive)
    .replace(/^(PAYPAL\s*\*|SumUp\s*\*|AMZN\s*Mktp\s*)/i, '')
    // Remove legal entity suffixes (case-insensitive)
    .replace(/\s+(GmbH|Co\.\s*KG|S\.?a\.?r\.?l\.?|Limited|AG|UG|e\.?V\.?)$/i, '')
    // Remove trailing transaction IDs/numbers (common in PSP transactions)
    .replace(/\s+\d{6,}$/, '')
    // Normalize whitespace (multiple spaces to single space)
    .replace(/\s+/g, ' ')
    // Trim
    .trim();
}

