/**
 * Cash withdrawal detection for ATM / cash machine transactions.
 * Detects common German bank formats, especially comdirect patterns.
 */

/**
 * Normalize text for matching: uppercase, remove diacritics, squeeze whitespace.
 */
function normalizeText(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return '';
  let text = String(input)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '') // Remove diacritics
    .toUpperCase();
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Check if transaction text indicates a cash withdrawal (ATM / cash machine).
 * 
 * Detects patterns like:
 * - "AUSZAHLUNG GAA" (comdirect)
 * - "Bargeldauszahlung Deutsche Bank ..."
 * - "GAA | Auftraggeber: DEUTSCHE BANK ... Bargeldauszahlung"
 * - "GELDAUTOMAT" (generic ATM)
 * - "ATM" (English ATM)
 * 
 * Real-world example that must match:
 * "Auszahlung GAA | Auftraggeber: DEUTSCHE BANK Buchungstext: Bargeldauszahlung Deutsche Bank//Köln/DE ..."
 * 
 * @param purpose - Transaction purpose text (from purpose field)
 * @param memo - Transaction memo text (optional)
 * @param bankProfile - Bank profile identifier (e.g., 'comdirect') for profile-specific matching
 * @returns true if this looks like a cash withdrawal
 */
export function isCashWithdrawalLike(
  purpose: string | null | undefined,
  memo: string | null | undefined,
  bankProfile?: string | null,
): boolean {
  // Combine all text fields for analysis
  const purposeNorm = normalizeText(purpose);
  const memoNorm = normalizeText(memo);
  const combinedText = [purposeNorm, memoNorm].filter(Boolean).join(' ');

  if (!combinedText || combinedText.trim().length === 0) {
    return false;
  }

  // Pattern 1: comdirect / Deutsche Bank "AUSZAHLUNG GAA" pattern
  // Matches: "Auszahlung GAA | Auftraggeber: ..."
  if (/AUSZAHLUNG\s+GAA/i.test(combinedText)) {
    return true;
  }

  // Pattern 2: "Bargeldauszahlung" (German for cash withdrawal)
  // Matches: "Bargeldauszahlung Deutsche Bank ..."
  if (/BARGELDAUSZAHLUNG/i.test(combinedText)) {
    return true;
  }

  // Pattern 3: "GAA" + "Bargeld" together (comdirect pattern)
  // Matches: "GAA | ... Bargeldauszahlung ..."
  if (/GAA/i.test(combinedText) && /BARGELD/i.test(combinedText)) {
    return true;
  }

  // Pattern 4: "GELDAUTOMAT" (German for ATM / cash machine)
  if (/\bGELDAUTOMAT\b/i.test(combinedText)) {
    return true;
  }

  // Pattern 5: "ATM" as a word (English ATM)
  if (/\bATM\b/i.test(combinedText)) {
    // Be conservative: only match if combined with withdrawal keywords or bank names
    const hasWithdrawalKeyword = 
      /AUSZAHLUNG|WITHDRAWAL|BARGELD|CASH/i.test(combinedText);
    const hasBankName = 
      /BANK|SPARKASSE|DEUTSCHE|COMDIRECT|ING|DKB/i.test(combinedText);
    if (hasWithdrawalKeyword || hasBankName) {
      return true;
    }
  }

  // Pattern 6: comdirect-specific "GAA" pattern with Auftraggeber context
  // Example: "GAA | Auftraggeber: DEUTSCHE BANK ..." (even without explicit "Bargeldauszahlung")
  // This catches cases where the text structure suggests an ATM withdrawal
  if (/GAA/i.test(combinedText)) {
    const hasAuftraggeber = /AUFTRAGGEBER/i.test(combinedText);
    const hasBankContext = /DEUTSCHE\s+BANK|BANK/i.test(combinedText);
    // If it's comdirect and has both GAA + Auftraggeber + Bank, it's likely a cash withdrawal
    if (bankProfile === 'comdirect' && hasAuftraggeber && hasBankContext) {
      return true;
    }
    // Also check if purpose starts with "Auszahlung GAA" pattern
    if (/^AUSZAHLUNG\s+GAA/i.test(purposeNorm)) {
      return true;
    }
  }

  return false;
}

/**
 * CASH WITHDRAWAL DETECTION SUMMARY
 * ==================================
 * 
 * This module detects cash withdrawals (ATM / cash machine transactions) from German bank formats,
 * especially comdirect patterns.
 * 
 * Supported patterns:
 * 1. "AUSZAHLUNG GAA" - comdirect ATM withdrawal marker
 * 2. "BARGELDAUSZAHLUNG" - German "cash withdrawal" text
 * 3. "GAA" + "BARGELD" together - comdirect pattern combining both markers
 * 4. "GELDAUTOMAT" - German "cash machine" / ATM
 * 5. "ATM" (word boundary) with withdrawal keywords or bank names
 * 6. comdirect-specific: "GAA" + "AUFTRAGGEBER" + bank name context
 * 
 * Real-world example that matches:
 * "Auszahlung GAA | Auftraggeber: DEUTSCHE BANK Buchungstext: Bargeldauszahlung Deutsche Bank//Köln/DE ..."
 * 
 * Detection flow:
 * - Text is normalized (uppercase, diacritics removed, whitespace squeezed)
 * - Both purpose and memo fields are checked and combined
 * - Patterns are checked in order, returning true on first match
 * - Conservative matching: "ATM" alone requires additional context (withdrawal keyword or bank name)
 * 
 * Integration:
 * - Called during import normalization (normalizeCanonicalRow in db.ts)
 * - Sets isCashWithdrawal flag on transaction records
 * - Used by categorization engine (engine.ts) to override category to cash:withdrawal
 * - Excluded from Sonstiges wizard (review.ts) via SQL WHERE clause
 * - Excluded from spending summaries (summary.ts) by default
 */

