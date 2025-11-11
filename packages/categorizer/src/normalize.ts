/**
 * Normalize text for matching: strip diacritics, lowercase, collapse spaces
 */

/**
 * Simple diacritic removal (handles common German characters)
 */
function removeDiacritics(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss');
}

/**
 * Normalize text for matching
 */
export function normalize(text: string): string {
  return removeDiacritics(text.toLowerCase().trim()).replace(/\s+/g, ' ');
}

