import { parse } from 'csv-parse/sync';

import { tryDecodeBuffer } from '../utils/encoding';

import { normalizeHeader } from '../utils/header';

import type { DetectionCandidate, ParseResult, ParsedRow } from './types';

import {

  parseGermanDateToIso,

  parseGermanMoneyToCents,

  directionFromAmount,

} from './bankCommon';

const PROFILE_ID = 'comdirect';

function hasComdirectPreamble(lines: string[]): boolean {

  return lines.some((line) => {

    const lower = line.toLowerCase();

    return (

      lower.includes('umsätze girokonto') ||

      lower.includes('umsaetze girokonto') ||

      lower.includes('umse4tze girokonto') // encoding-glitched variant

    );

  });

}

function hasComdirectHeader(lines: string[]): boolean {

  return lines.some((line) => {

    const normalized = line

      .toLowerCase()

      .replace(/"/g, '')

      .replace(/\s+/g, ' ')

      .trim();

    return (

      normalized.includes('buchungstag') &&

      normalized.includes('umsatz') &&

      (normalized.includes('buchungstext') || normalized.includes('vorgang'))

    );

  });

}

function findHeaderLineIndex(lines: string[]): number {

  for (let i = 0; i < lines.length; i++) {

    const normalized = lines[i]

      .toLowerCase()

      .replace(/"/g, '')

      .replace(/\s+/g, ' ')

      .trim();

    if (normalized.includes('buchungstag') && normalized.includes('umsatz')) {

      return i;

    }

  }

  return -1;

}

/**

 * Detection for comdirect Girokonto CSV exports.

 * Handles variants with preamble ("Umsätze Girokonto", "Zeitraum: 30 Tage")

 * and header lines with either ';' or '\t' as delimiter.

 */

export function detectComdirectCsv(text: string): DetectionCandidate | null {

  const lines = text.split(/\r?\n/).slice(0, 30);

  const preamble = hasComdirectPreamble(lines);

  const header = hasComdirectHeader(lines);

  if (!preamble && !header) {

    return null;

  }

  const confidence = preamble && header ? 0.99 : 0.9;

  return {

    profileId: PROFILE_ID,

    confidence,

  };

}

/**

 * Parse comdirect Girokonto CSV exports into ParseResult.

 * Supports:

 * - Preambles ("Umsätze Girokonto", "Neuer Kontostand ...")

 * - Header + rows separated by ';' (older/newer exports)

 * - Header + rows separated by '\\t' (tab, as in some real exports)

 */

export function parseComdirectCsv(buffer: Buffer): ParseResult {

  const text = tryDecodeBuffer(buffer);

  const lines = text.split(/\r?\n/);

  const headerIndex = findHeaderLineIndex(lines);

  if (headerIndex === -1) {

    throw new Error('comdirect CSV: Kopfzeile nicht erkannt.');

  }

  // Only feed the header+data part into csv-parse, strip off the preamble above

  const dataText = lines.slice(headerIndex).join('\n');

  const parseWithDelim = (delimiter: ';' | '\t') => {

    const records = parse(dataText, {

      columns: true,

      skip_empty_lines: true,

      delimiter,

      relax_column_count: true,

      bom: true,

      trim: true,

    }) as Record<string, string>[];

    return records;

  };

  let records = parseWithDelim(';');

  // If we only got a single column, it's likely actually tab-delimited

  if (records.length === 0 || Object.keys(records[0]).length === 1) {

    records = parseWithDelim('\t');

  }

  const warnings: string[] = [];

  const rows: ParsedRow[] = [];

  for (const record of records) {

    const normalizedMap: Record<string, string> = {};

    for (const [key, value] of Object.entries(record)) {

      normalizedMap[normalizeHeader(key)] = value;

    }

    const bookingRaw = normalizedMap['buchungstag'] || '';

    const valutaRaw =

      normalizedMap['wertstellung (valuta)'] ||

      normalizedMap['wertstellung_valuta'] ||

      normalizedMap['wertstellung'] ||

      normalizedMap['valuta'] ||

      '';

    const amountRaw =

      normalizedMap['umsatz in eur'] ||

      normalizedMap['umsatz_in_eur'] ||

      normalizedMap['umsatz'] ||

      normalizedMap['betrag'] ||

      '';

    const purpose =

      normalizedMap['buchungstext'] ||

      normalizedMap['verwendungszweck'] ||

      '';

    const vorgang = normalizedMap['vorgang'] || '';

    const bookingDate = parseGermanDateToIso(bookingRaw);

    if (!bookingDate) {

      warnings.push(

        `Zeile übersprungen: ungültiges Buchungsdatum "${bookingRaw}".`,

      );

      continue;

    }

    const valutaDate = parseGermanDateToIso(valutaRaw);

    const amountCents = parseGermanMoneyToCents(amountRaw);

    if (amountCents === null || amountCents === 0) {

      warnings.push('Zeile übersprungen: Betrag 0 oder nicht lesbar.');

      continue;

    }

    const currency = 'EUR'; // comdirect Giro exports are EUR in our current scope

    const direction = directionFromAmount(amountCents);

    const rawTextParts = [vorgang, purpose].filter(Boolean);

    const rawText = rawTextParts.join(' | ');

    const externalId = buildComdirectExternalId({

      bookingDate,

      amountCents,

      currency,

      vorgang,

      purpose,

    });

    const row: ParsedRow = {

      bookingDate,

      valutaDate,

      amountCents,

      currency,

      direction,

      accountId: 'comdirect:giro',

      accountIban: null,

      counterparty: null,

      counterpartyIban: null,

      reference: null,

      externalId,

      rawText,

      raw: {

        ...record,

        profileId: PROFILE_ID,

      },

      categorySource: 'fallback',

    };

    rows.push(row);

  }

  if (rows.length === 0) {

    throw new Error('comdirect CSV: keine gültigen Buchungen gefunden.');

  }

  const candidates: DetectionCandidate[] = [

    { profileId: PROFILE_ID, confidence: 0.95 },

  ];

  return {

    profileId: PROFILE_ID,

    confidence: 0.95,

    rows,

    warnings,

    candidates,

  };

}

function buildComdirectExternalId(input: {

  bookingDate: string;

  amountCents: number;

  currency: string;

  vorgang: string;

  purpose: string;

}): string {

  const baseRefSource = `${input.vorgang} ${input.purpose}`.trim();

  // Prefer the bank's own reference if available, e.g. "Ref. AM2C21SJ16EKF9UL/81132"

  const refMatch = /ref\.?\s*([A-Z0-9/]+)/i.exec(baseRefSource);

  if (refMatch) {

    return `comdirect-${refMatch[1]}`;

  }

  // Fallback: deterministic hash over core transaction attributes

  const base = [

    PROFILE_ID,

    input.bookingDate,

    input.amountCents,

    input.currency,

    baseRefSource.slice(0, 64),

  ].join('|');

  let hash = 0;

  for (let i = 0; i < base.length; i++) {

    const chr = base.charCodeAt(i);

    hash = (hash << 5) - hash + chr;

    hash |= 0;

  }

  return `${PROFILE_ID}-${input.bookingDate}-${Math.abs(hash)}`;

}

