import { parse as parseCsv } from 'csv-parse/sync';
import iconv from 'iconv-lite';
import { detectBank } from './detect.js';
import type { ParsedTransaction, BankId } from './types.js';
import * as COM from './banks/comdirect.js';
import * as SPK from './banks/sparkasse.js';
import * as DB from './banks/deutsche-bank.js';

const registry: Record<BankId, (rows: Record<string, string>[]) => ParsedTransaction[]> = {
  'comdirect': COM.parse,
  'sparkasse': SPK.parse,
  'deutsche-bank': DB.parse,
};

/**
 * Try to decode buffer as UTF-8, fallback to CP1252 if replacement chars detected
 */
function tryDecode(buf: Buffer): string {
  const s = buf.toString('utf8');
  if (!s.includes('\uFFFD')) return s;
  return iconv.decode(buf, 'win1252');
}

/**
 * Detect delimiter: prefer ; if present, otherwise ,
 */
function detectDelimiter(s: string): string {
  return s.includes(';') ? ';' : ',';
}

/**
 * Parse CSV buffer into normalized transactions
 * @param input CSV file buffer
 * @param hinted Optional bank hint to skip auto-detection
 */
export function parseTransactions(input: Buffer, hinted?: BankId): ParsedTransaction[] {
  const decoded = tryDecode(input);
  const rows = parseCsv(decoded, {
    columns: true,
    delimiter: detectDelimiter(decoded),
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
  }) as Record<string, string>[];

  if (!rows.length) return [];

  const bank = hinted ?? detectBank(rows[0]);
  if (!bank) throw new Error('Unsupported or undetected bank');

  return registry[bank](rows);
}

export * from './types.js';
