/**
 * Import Utility Functions
 * 
 * Shared utilities for parsing German date/number formats and generating hash IDs.
 */

import crypto from 'node:crypto';

/**
 * Parse German date format (DD.MM.YYYY or DD.MM.YY) to ISO 8601
 */
export function parseGermanDate(value: string | null | undefined): string {
  if (!value) return '';
  
  const v = String(value).trim();
  
  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  
  // DD.MM.YYYY or DD.MM.YY
  const m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += 2000; // Handle 2-digit years
    if (y < 1900 || y > 2100) return ''; // Sanity check
    try {
      return new Date(Date.UTC(y, mo - 1, d)).toISOString().slice(0, 10);
    } catch {
      return '';
    }
  }
  
  // Try standard Date parsing as fallback
  try {
    const t = new Date(v);
    if (!Number.isNaN(t.getTime())) {
      return new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())).toISOString().slice(0, 10);
    }
  } catch {
    // Ignore
  }
  
  return '';
}

/**
 * Parse German number format (1.000,50 or 1,000.50) to number
 * Returns amount in cents as integer
 */
export function parseGermanNumber(value: string | null | undefined): number {
  if (!value) return 0;
  
  let raw = String(value)
    .replace(/\u00A0/g, ' ') // Normalize non-breaking space
    .trim();
  
  // Detect negative (accounting format: (1.234,56) or trailing minus)
  let negative = false;
  if (/^\(.*\)$/.test(raw)) {
    negative = true;
    raw = raw.replace(/[()]/g, '');
  }
  if (raw.endsWith('-')) {
    negative = true;
    raw = raw.replace(/-$/, '');
  }
  
  // Remove currency symbols and spaces
  raw = raw.replace(/[€$£A-Za-z\s]/g, '');
  
  // Detect format: if last punctuation is comma, it's German format
  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  
  if (lastComma > lastDot) {
    // German format: 1.000,50 -> 1000.50
    raw = raw.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // US format: 1,000.50 -> 1000.50
    raw = raw.replace(/,/g, '');
  } else {
    // No decimal separator, just remove thousands separators
    raw = raw.replace(/[,.]/g, '');
  }
  
  const num = Number(raw);
  if (Number.isNaN(num)) return 0;
  
  // Convert to cents
  const cents = Math.round(num * 100);
  return negative ? -Math.abs(cents) : cents;
}

/**
 * Generate MD5 hash for deduplication
 * Hash = MD5(date + amountCents + payee + description)
 */
export function generateHashId(
  date: string,
  amountCents: number,
  payee: string,
  description: string
): string {
  const data = `${date}|${amountCents}|${payee}|${description}`;
  return crypto.createHash('md5').update(data).digest('hex');
}

/**
 * Normalize text for matching (uppercase, remove common suffixes)
 */
export function normalizeText(text: string): string {
  return text
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/\b(GMBH|CO KG|E\.K\.|E\.K|AG|UG)\b/gi, '')
    .trim();
}

