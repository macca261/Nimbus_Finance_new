import { parse as parseCsv } from 'csv-parse/sync';
import iconv from 'iconv-lite';
import { detectBank } from './detect.js';
import type { ParsedTransaction, BankId } from './types.js';
import * as DB from './banks/deutsche-bank.js';
import * as CB from './banks/commerzbank.js';
import * as ING from './banks/ing.js';
import * as PB from './banks/postbank.js';

const registry: Record<BankId, (rows: Record<string, string>[]) => ParsedTransaction[]> = {
  'deutsche-bank': DB.parse,
  'commerzbank': CB.parse,
  'ing': ING.parse,
  'postbank': PB.parse,
};

function tryDecode(buf: Buffer): string {
  const utf8 = buf.toString('utf8');
  if (!utf8.includes('\uFFFD')) return utf8;
  return iconv.decode(buf, 'latin1'); // ISO-8859-1 / CP1252-ish
}

function detectDelimiter(s: string): string {
  return s.includes(';') ? ';' : ',';
}

export function parseTransactions(input: Buffer, hintedBank?: BankId): ParsedTransaction[] {
  const decoded = tryDecode(input);
  const rows = parseCsv(decoded, {
    columns: true,
    delimiter: detectDelimiter(decoded),
    skip_empty_lines: true,
  }) as Record<string, string>[];

  if (!rows.length) return [];

  const bank = hintedBank ?? detectBank(rows[0]);
  if (!bank || !registry[bank]) throw new Error('Unsupported or undetected bank');

  return registry[bank](rows);
}

export * from './types.js';

