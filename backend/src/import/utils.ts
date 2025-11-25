/**
 * Import Utilities
 * 
 * Helper functions for CSV parsing, number normalization, and encoding detection.
 * Handles German banking formats and international formats.
 */

import * as fs from 'fs';
import * as chardet from 'chardet';

/**
 * Parse German number format: "1.234,56" -> 123456 (cents)
 * 
 * Handles:
 * - Thousands separator: dot (.)
 * - Decimal separator: comma (,)
 * - Negative numbers: "-1.234,56" or "(1.234,56)"
 * - Whitespace and currency symbols
 */
export function parseGermanNumber(str: string): number {
  if (!str || typeof str !== 'string') {
    return 0;
  }

  // Remove whitespace and currency symbols
  let cleaned = str.trim().replace(/[€$£]/g, '').trim();

  // Handle negative in parentheses: "(1.234,56)" -> "-1.234,56"
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1);
  }

  // Remove thousands separators (dots)
  cleaned = cleaned.replace(/\./g, '');

  // Replace decimal comma with dot
  cleaned = cleaned.replace(',', '.');

  // Parse as float and convert to cents
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) {
    return 0;
  }

  return Math.round(parsed * 100);
}

/**
 * Parse international number format: "1,234.56" -> 123456 (cents)
 * 
 * Handles:
 * - Thousands separator: comma (,)
 * - Decimal separator: dot (.)
 * - Negative numbers: "-1,234.56"
 * - Whitespace and currency symbols
 */
export function parseInternationalNumber(str: string): number {
  if (!str || typeof str !== 'string') {
    return 0;
  }

  // Remove whitespace and currency symbols
  let cleaned = str.trim().replace(/[€$£]/g, '').trim();

  // Handle negative in parentheses: "(1,234.56)" -> "-1,234.56"
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1);
  }

  // Remove thousands separators (commas)
  cleaned = cleaned.replace(/,/g, '');

  // Parse as float and convert to cents
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) {
    return 0;
  }

  return Math.round(parsed * 100);
}

/**
 * Auto-detect number format and parse
 * 
 * Heuristic: If the last punctuation before the end is a comma, assume German format.
 * Otherwise, assume international format.
 */
export function parseNumberAuto(str: string): number {
  if (!str || typeof str !== 'string') {
    return 0;
  }

  const cleaned = str.trim().replace(/[€$£]/g, '').trim();
  
  // Find the last punctuation mark
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  // If comma comes after dot, it's German format (e.g., "1.234,56")
  if (lastComma > lastDot) {
    return parseGermanNumber(str);
  }

  // If dot comes after comma or no comma, it's international format (e.g., "1,234.56" or "1234.56")
  if (lastDot > lastComma) {
    return parseInternationalNumber(str);
  }

  // No punctuation or ambiguous - try German first, then international
  if (cleaned.includes(',')) {
    return parseGermanNumber(str);
  }

  return parseInternationalNumber(str);
}

/**
 * Parse German date format: "DD.MM.YYYY" or "DD.MM.YY" -> "YYYY-MM-DD"
 */
export function parseGermanDate(str: string): string {
  if (!str || typeof str !== 'string') {
    return new Date().toISOString().split('T')[0];
  }

  const cleaned = str.trim();
  
  // Try DD.MM.YYYY format
  const matchYYYY = cleaned.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (matchYYYY) {
    const [, day, month, year] = matchYYYY;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Try DD.MM.YY format (assume 20XX)
  const matchYY = cleaned.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})$/);
  if (matchYY) {
    const [, day, month, year] = matchYY;
    const fullYear = parseInt(year, 10) < 50 ? `20${year}` : `19${year}`;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Try ISO format (YYYY-MM-DD) - pass through
  if (cleaned.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return cleaned;
  }

  // Fallback: try to parse with Date
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  // Last resort: return today
  return new Date().toISOString().split('T')[0];
}

/**
 * Detect file encoding using chardet
 * 
 * Reads first 1KB for efficient detection.
 * Returns 'utf-8' or 'latin1' (ISO-8859-1)
 */
export async function detectEncoding(filePath: string): Promise<string> {
  try {
    // Read first 1KB for detection (as per requirements)
    const buffer = fs.readFileSync(filePath);
    const sample = buffer.slice(0, Math.min(1024, buffer.length));
    
    const detected = chardet.detect(sample);
    
    // Normalize to our supported encodings
    if (detected) {
      const lower = detected.toLowerCase();
      
      // Map common encodings to our supported ones
      if (lower.includes('iso-8859-1') || lower.includes('windows-1252') || lower.includes('latin1')) {
        return 'latin1';
      }
      
      if (lower.includes('utf-8') || lower.includes('utf8')) {
        return 'utf-8';
      }
    }
    
    // Default to UTF-8 if detection fails
    return 'utf-8';
  } catch (err) {
    console.warn('[import/utils] Failed to detect encoding, defaulting to UTF-8:', err);
    return 'utf-8';
  }
}

/**
 * Read first N lines of a file with encoding detection (for header sniffing)
 */
export function readFirstLines(
  filePath: string,
  lineCount: number = 20,
  encoding?: string
): string[] {
  try {
    // If encoding not provided, try UTF-8 first, then fallback to latin1
    let content: string;
    try {
      if (encoding) {
        const buffer = fs.readFileSync(filePath);
        content = require('iconv-lite').decode(buffer, encoding);
      } else {
        content = fs.readFileSync(filePath, 'utf-8');
      }
    } catch {
      // Fallback to latin1 if UTF-8 fails
      const buffer = fs.readFileSync(filePath);
      content = require('iconv-lite').decode(buffer, 'latin1');
    }
    
    const lines = content.split(/\r?\n/).slice(0, lineCount);
    return lines.filter(line => line.trim().length > 0);
  } catch (err) {
    console.warn('[import/utils] Failed to read first lines:', err);
    return [];
  }
}

/**
 * Find header row by scanning lines for known keywords
 * Returns the line index (0-based) where headers were found, or -1 if not found
 */
export function findHeaderRow(
  lines: string[],
  keywords: string[]
): number {
  for (let i = 0; i < lines.length; i++) {
    const lineUpper = lines[i].toUpperCase();
    // Check if all keywords are present in this line
    const allKeywordsFound = keywords.every(keyword => 
      lineUpper.includes(keyword.toUpperCase())
    );
    if (allKeywordsFound) {
      return i;
    }
  }
  return -1;
}

/**
 * Generate synthetic transaction ID from transaction data
 * Uses MD5 hash of date + amount + payee for deduplication
 */
export function generateSyntheticId(
  date: string,
  amountCents: number,
  payee: string,
): string {
  const crypto = require('crypto');
  const hashInput = `${date}|${amountCents}|${payee}`;
  return crypto.createHash('md5').update(hashInput, 'utf-8').digest('hex');
}
