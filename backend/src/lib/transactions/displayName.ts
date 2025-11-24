/**
 * Centralized helper to compute a human-friendly display name for a transaction.
 * Used across all user-facing views (dashboard, insights, AI summaries, etc.).
 * 
 * Priority order:
 * 1. payee (if present and non-empty)
 * 2. counterpartName (if present)
 * 3. purpose (if present)
 * 4. memo (if present)
 * 5. Fallback: "Unbekannt"
 * 
 * The displayName should be short and user-friendly, suitable for cards and lists.
 * Full raw booking text is available separately for detail views.
 */
export function computeTransactionDisplayName(row: {
  counterpartName?: string | null;
  payee?: string | null;
  purpose?: string | null;
  memo?: string | null;
}): string {
  const rawCounterpart = (row.counterpartName ?? '').trim();
  const rawPayee = (row.payee ?? '').trim();
  const rawPurpose = (row.purpose ?? '').trim();
  const rawMemo = (row.memo ?? '').trim();

  // Priority: payee > counterpartName > purpose > memo
  const candidate = rawPayee || rawCounterpart || rawPurpose || rawMemo;
  
  if (!candidate) {
    return 'Unbekannt';
  }

  // Clean up common technical prefixes and long reference numbers
  // Remove common bank prefixes like "Übertrag / Überweisung |"
  let cleaned = candidate
    .replace(/^(Übertrag\s*\/\s*Überweisung|Lastschrift\s*\/\s*Belastung|Kartenverfügung)\s*\|\s*/i, '')
    .replace(/\s*\|\s*Buchungstext:\s*/i, ' ')
    .replace(/\s*\|\s*Auftraggeber:\s*/i, ' ')
    .trim();

  // Truncate very long strings (e.g., reference numbers) - keep first 60 chars
  if (cleaned.length > 60) {
    cleaned = cleaned.substring(0, 57) + '...';
  }

  return cleaned || 'Unbekannt';
}

