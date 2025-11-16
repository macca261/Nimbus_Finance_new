import type { DetectionCandidate, ParseResult, ParsedRow } from './types';

import {

  parseBankCsvRecords,

  parseGermanDateToIso,

  parseGermanMoneyToCents,

  directionFromAmount,

} from './bankCommon';

import { normalizeHeader } from '../utils/header';

const PROFILE_ID = 'dkb';

/**

 * DKB Giro detection.

 *

 * Real header example (from fixtures):

 * "Buchungstag";"Wertstellung";"Buchungstext";"Verwendungszweck";

 * "Auftraggeber / Beguenstigter/Zahlungspflichtiger";"IBAN";"Betrag (EUR)";"Waehrung"

 */

export function detectDkbCsv(text: string): DetectionCandidate | null {

  const lines = text.split(/\r?\n/).slice(0, 10);

  if (lines.length === 0) return null;

  const headerLine = lines.find((line) =>

    line.toLowerCase().includes('buchungstag'),

  );

  if (!headerLine) return null;

  const norm = headerLine.toLowerCase();

  // DKB has two CSV formats:
  // 1. Full: "Buchungstag";"Wertstellung";"Buchungstext";"Verwendungszweck";"Auftraggeber / Beguenstigter/Zahlungspflichtiger";"IBAN";"Betrag (EUR)";"Waehrung"
  // 2. Simple: "Buchungstag";"Wertstellung";"Verwendungszweck";"Betrag"
  const hasFullFormat =
    norm.includes('buchungstext') &&
    norm.includes('verwendungszweck') &&
    (norm.includes('betrag (eur)') || norm.includes('betrag') || norm.includes('umsatz')) &&
    (norm.includes('zahlungspflichtiger') ||
      norm.includes('begünstigter') ||
      norm.includes('beguenstigter'));

  const hasSimpleFormat =
    norm.includes('verwendungszweck') &&
    (norm.includes('betrag') || norm.includes('umsatz')) &&
    !norm.includes('buchungstext'); // Simple format doesn't have Buchungstext

  if (!hasFullFormat && !hasSimpleFormat) return null;

  return {

    profileId: PROFILE_ID,

    confidence: 0.97,

  };

}

export function parseDkbCsv(buffer: Buffer): ParseResult {

  const { records } = parseBankCsvRecords(buffer);

  const warnings: string[] = [];

  const rows: ParsedRow[] = [];

  for (const record of records as Record<string, string>[]) {

    const normalizedMap: Record<string, string> = {};

    for (const [key, value] of Object.entries(record)) {

      normalizedMap[normalizeHeader(key)] = value;

    }

    const bookingRaw = normalizedMap['buchungstag'] || '';

    const valutaRaw =

      normalizedMap['wertstellung'] ||

      normalizedMap['valuta'] ||

      '';

    const purpose =

      normalizedMap['verwendungszweck'] ||

      normalizedMap['buchungstext'] ||

      '';

    // Simple format doesn't have counterparty column

    const counterparty =

      // Real header is "Beguenstigter/Zahlungspflichtiger" → normalizeHeader: "beguenstigter/zahlungspflichtiger"

      normalizedMap['beguenstigter/zahlungspflichtiger'] ||

      normalizedMap['auftraggeber_begünstigter_zahlungspflichtiger'] ||

      normalizedMap['auftraggeber_beguenstigter_zahlungspflichtiger'] ||

      normalizedMap['begünstigter_zahlungspflichtiger'] ||

      normalizedMap['beguenstigter_zahlungspflichtiger'] ||

      normalizedMap['auftraggeber_begünstigter'] ||

      normalizedMap['auftraggeber_beguenstigter'] ||

      normalizedMap['auftraggeber'] ||

      normalizedMap['begünstigter'] ||

      normalizedMap['beguenstigter'] ||

      '';

    const iban =

      normalizedMap['iban'] ||

      normalizedMap['kontonummer'] ||

      '';

    const amountRaw =

      // Real header is "Betrag (EUR)" → normalizeHeader keeps spaces: "betrag (eur)"

      normalizedMap['betrag (eur)'] ||

      normalizedMap['betrag_eur'] ||

      normalizedMap['betrag_(eur)'] ||

      normalizedMap['betrag'] ||

      normalizedMap['umsatz_in_eur'] ||

      normalizedMap['umsatz'] ||

      '';

    const currency =

      normalizedMap['waehrung'] ||

      normalizedMap['währung'] ||

      normalizedMap['wahrung'] ||

      'EUR';

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

    const direction = directionFromAmount(amountCents);

    const rawTextParts = [purpose, counterparty].filter(Boolean);

    const rawText = rawTextParts.join(' | ');

    const externalId = buildDkbExternalId({

      bookingDate,

      amountCents,

      currency,

      purpose,

      counterparty,

      normalizedMap,

    });

    const row: ParsedRow = {

      bookingDate,

      valutaDate,

      amountCents,

      currency,

      direction,

      accountId: 'dkb:giro',

      accountIban: iban || null,

      counterparty: counterparty || null,

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

    throw new Error('DKB CSV: keine gültigen Buchungen gefunden.');

  }

  const candidates: DetectionCandidate[] = [

    { profileId: PROFILE_ID, confidence: 0.97 },

  ];

  return {

    profileId: PROFILE_ID,

    confidence: 0.97,

    rows,

    warnings,

    candidates,

  };

}

function buildDkbExternalId(input: {

  bookingDate: string;

  amountCents: number;

  currency: string;

  purpose: string;

  counterparty: string;

  normalizedMap: Record<string, string>;

}): string {

  const ref =

    input.normalizedMap['kundenreferenz_end_to_end'] ||

    input.normalizedMap['kundenreferenz'] ||

    input.normalizedMap['end_to_end_id'] ||

    '';

  if (ref) {

    return `${PROFILE_ID}-${ref}`;

  }

  const base = [

    PROFILE_ID,

    input.bookingDate,

    input.amountCents,

    input.currency,

    input.purpose.slice(0, 64),

    input.counterparty.slice(0, 64),

  ].join('|');

  let hash = 0;

  for (let i = 0; i < base.length; i++) {

    const chr = base.charCodeAt(i);

    hash = (hash << 5) - hash + chr;

    hash |= 0;

  }

  return `${PROFILE_ID}-${input.bookingDate}-${Math.abs(hash)}`;

}
