export function parseGermanMoneyToCents(input: string): number {
  // Trim and normalize NBSP
  const s = (input || '').replace(/\u00A0/g, ' ').trim();
  if (!s) return 0;

  // Remove currency suffix/prefix, spaces
  const cleaned = s
    .replace(/[€\s]/g, '')
    .replace(/\./g, '')   // thousands
    .replace(',', '.');   // decimal

  const num = Number(cleaned);
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100);
}

