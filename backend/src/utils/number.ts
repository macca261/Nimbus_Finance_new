/**
 * Normalize German-formatted numbers to a JS number.
 * Examples: "1.234,56" -> 1234.56, "-12,00" -> -12, "1 234,56" -> 1234.56
 */
export function normalizeGermanNumber(input: string): number {
  if (input == null) return NaN;
  let s = String(input).trim();
  if (!s) return NaN;
  // Remove non-breaking spaces and normal spaces used as thousands separators
  s = s.replace(/\u00A0/g, ' ');
  // Keep sign
  const sign = /^-/.test(s) ? -1 : 1;
  s = s.replace(/^[-+]/, '');
  // Remove thousands separators (., ' or spaces)
  s = s.replace(/[.'\s]/g, '');
  // Replace decimal comma with dot
  s = s.replace(/,(\d{1,})$/, '.$1');
  // If there is still a comma somewhere, replace all commas with dot as fallback
  if (s.includes(',')) s = s.replace(/,/g, '.');
  const n = Number(s);
  return sign * n;
}


