// packages/parsers-de/src/index.ts

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

  // Prefer UTF-8; fall back to Latin1 (cp1252/ISO-8859-1) if we see replacement chars.

  const utf8 = buf.toString('utf8');

  return utf8.includes('\uFFFD') ? iconv.decode(buf, 'latin1') : utf8;

}



function countCharOutsideQuotes(line: string, ch: string) {

  let count = 0, inQ = false;

  for (let i = 0; i < line.length; i++) {

    const c = line[i];

    if (c === '"') inQ = !inQ;

    else if (!inQ && c === ch) count++;

  }

  return count;

}



function detectDelimiterSmart(sampleLines: string[]): ';' | ',' {

  // Look at up to 20 non-empty lines and count delimiters outside quotes

  let semi = 0, comma = 0, seen = 0;

  for (const line of sampleLines) {

    const t = line.trim();

    if (!t) continue;

    semi += countCharOutsideQuotes(t, ';');

    comma += countCharOutsideQuotes(t, ',');

    if (++seen >= 20) break;

  }

  // Default to ';' for German exports if tie/zero (safer default)

  if (semi === comma) return ';';

  return semi > comma ? ';' : ',';

}



const HEADER_HINTS = [

  'buchungstag',

  'buchungsdatum',

  'wertstellung',

  'valuta',

  'betrag',

  'umsatz',

  'verwendungszweck',

  'buchungstext',

  'auftraggeber',

  'empfänger',

  'begünstigter',

  'name',

  'iban',

  'bic',

];



function looksLikeHeader(line: string): boolean {

  const low = line.toLowerCase();

  return HEADER_HINTS.some((h) => low.includes(h));

}



function findHeaderIndex(lines: string[], delimiter: ';' | ','): number {

  // Many DE bank CSVs have 3–6 lines of preamble, then the header.

  for (let i = 0; i < Math.min(lines.length, 50); i++) {

    const t = lines[i].trim();

    if (!t) continue;

    if (!looksLikeHeader(t)) continue;



    // sanity: header should have at least 3 columns with our delimiter

    const cols = t.split(delimiter);

    if (cols.length >= 3) return i;

  }

  // Fallback: first non-empty line

  for (let i = 0; i < lines.length; i++) {

    if (lines[i].trim()) return i;

  }

  return 0;

}



export function parseTransactions(input: Buffer, hintedBank?: BankId): ParsedTransaction[] {

  const decoded = tryDecode(input);



  // Split into lines for analysis (keeping memory low)

  const lines = decoded.split(/\r?\n/);

  const delimiter = detectDelimiterSmart(lines);

  const headerIdx = findHeaderIndex(lines, delimiter);



  // Re-join starting from header so csv-parse sees correct header as first row

  const csvFromHeader = lines.slice(headerIdx).join('\n');



  // Relax column counts; skip blatantly broken rows

  const records = parseCsv(csvFromHeader, {

    columns: true,

    delimiter,

    skip_empty_lines: true,

    relax_column_count: true,

    relax_quotes: true,

    // If a row is malformed, skip it instead of throwing entire parse

    on_record: (rec) => rec,

  }) as Record<string, string>[];



  if (!records.length) return [];



  const bank = hintedBank ?? detectBank(records[0]);

  if (!bank || !registry[bank]) throw new Error('Unsupported or undetected bank');



  return registry[bank](records);

}

export * from './types.js';

