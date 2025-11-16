import type { DetectionCandidate, ParseResult, ParsedRow } from './types';

import {

  parseBankCsvRecords,

  parseGermanDateToIso,

  parseGermanMoneyToCents,

  directionFromAmount,

} from './bankCommon';

import { normalizeHeader } from '../utils/header';

const PROFILE_ID = 'ing';

/**

 * ING CSV detection:

 * Header typically contains "Buchung", "Valuta", "Auftraggeber/Empfänger",

 * "Buchungstext"/"Verwendungszweck", "Betrag (EUR)".

 */

export function detectIngCsv(text: string): DetectionCandidate | null {

  const lines = text.split(/\r?\n/).slice(0, 10);

  if (lines.length === 0) return null;

  // Find header line - look for lines containing booking date field
  const headerLine = lines.find((line) => {
    const l = line.toLowerCase();
    return l.includes('buchung') || l.includes('buchungsdatum');
  });

  if (!headerLine) return null;

  const norm = headerLine.toLowerCase();

  // ING has distinctive combinations:
  // 1. Must have a booking date field (Buchung or Buchungsdatum)
  const hasBookingDate = norm.includes('buchung') || norm.includes('buchungsdatum');
  if (!hasBookingDate) return null;

  // 2. Must have a value date field (Valuta or Wertstellung)
  const hasValueDate = norm.includes('valuta') || norm.includes('wertstellung');
  if (!hasValueDate) return null;

  // 3. Must have an amount field (Betrag)
  const hasAmount = norm.includes('betrag');
  if (!hasAmount) return null;

  // 4. Should have a purpose field (Verwendungszweck or Buchungstext)
  const hasPurpose = norm.includes('verwendungszweck') || norm.includes('buchungstext');

  // Counterparty field is optional (some ING exports don't have it)
  const hasCounterparty = norm.includes('auftraggeber') || norm.includes('empfänger') || norm.includes('empfaenger');

  // Strong match: has all key fields
  if (hasBookingDate && hasValueDate && hasAmount && hasPurpose) {
    return {
      profileId: PROFILE_ID,
      confidence: 0.97, // High confidence for complete ING header
    };
  }

  // Good match: has booking date, value date, amount (purpose optional for some formats)
  if (hasBookingDate && hasValueDate && hasAmount) {
    return {
      profileId: PROFILE_ID,
      confidence: 0.95,
    };
  }

  return null;

}

export function parseIngCsv(buffer: Buffer): ParseResult {

  const { records } = parseBankCsvRecords(buffer);

  const warnings: string[] = [];

  const rows: ParsedRow[] = [];

  for (const record of records as Record<string, string>[]) {

    const normalizedMap: Record<string, string> = {};

    for (const [key, value] of Object.entries(record)) {

      normalizedMap[normalizeHeader(key)] = value;

    }

    // ING has two CSV formats:
    // Format 1 (ing_min.csv): "Buchung", "Valuta", "Auftraggeber/Empfänger", "Buchungstext", "Verwendungszweck", "Betrag", "Währung"
    // Format 2 (ing.csv): "Buchungsdatum", "Wertstellung", "Verwendungszweck", "Betrag (EUR)"
    const bookingRaw =

      normalizedMap['buchung'] ||

      normalizedMap['buchungsdatum'] || // Format 2 uses this

      normalizedMap['datum'] ||

      '';

    const valutaRaw = 

      normalizedMap['valuta'] ||

      normalizedMap['wertstellung'] || // Format 2 uses this

      '';

    const purpose =

      normalizedMap['buchungstext'] ||

      normalizedMap['verwendungszweck'] ||

      '';

    // Counterparty may not be present in all ING exports
    const counterparty =

      normalizedMap['auftraggeber_empfänger'] ||

      normalizedMap['auftraggeber_empfaenger'] ||

      normalizedMap['auftraggeber'] ||

      normalizedMap['empfänger'] ||

      normalizedMap['empfaenger'] ||

      '';

    const iban =

      normalizedMap['iban'] ||

      normalizedMap['kontonummer'] ||

      '';

    const amountRaw =

      normalizedMap['betrag (eur)'] || // Format 2: "Betrag (EUR)"

      normalizedMap['betrag_eur'] ||

      normalizedMap['betrag'] ||

      '';

    const currency =

      normalizedMap['waehrung'] ||

      normalizedMap['wahrung'] ||

      normalizedMap['währung'] ||

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

    const externalId = buildIngExternalId({

      bookingDate,

      amountCents,

      currency,

      purpose,

      counterparty,

    });

    const row: ParsedRow = {

      bookingDate,

      valutaDate,

      amountCents,

      currency,

      direction,

      accountId: 'ing:giro',

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

    throw new Error('ING CSV: keine gültigen Buchungen gefunden.');

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

function buildIngExternalId(input: {

  bookingDate: string;

  amountCents: number;

  currency: string;

  purpose: string;

  counterparty: string;

}): string {

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

