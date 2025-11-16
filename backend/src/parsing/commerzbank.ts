import type { DetectionCandidate, ParseResult, ParsedRow } from './types';

import { parseBankCsvRecords, parseGermanDateToIso, parseGermanMoneyToCents, directionFromAmount } from './bankCommon';

import { normalizeHeader } from '../utils/header';

const PROFILE_ID = 'commerzbank';

/**

 * Detection for Commerzbank CSV:

 * Header like:

 * "Buchungstag";"Wertstellung";"Vorgang";"Verwendungszweck";"Auftraggeber/Empfänger";"IBAN";"Betrag";"Währung"

 */

export function detectCommerzbankCsv(text: string): DetectionCandidate | null {

  const lines = text.split(/\r?\n/).slice(0, 10);

  if (lines.length === 0) return null;

  const headerLine = lines.find((line) =>

    line.toLowerCase().includes('buchungstag'),

  );

  if (!headerLine) return null;

  const norm = headerLine.toLowerCase();

  // Strong signal: "Vorgang" is unique to Commerzbank
  const hasVorgang = norm.includes('vorgang');

  // Commerzbank uses "Auftraggeber/Empfänger" (not "Beguenstigter/Zahlungspflichtiger" like DKB)
  const hasAuftraggeberEmpfaenger = 
    (norm.includes('auftraggeber') && norm.includes('empfänger')) ||
    (norm.includes('auftraggeber') && norm.includes('empfaenger'));

  // Commerzbank uses "Währung" with umlaut (DKB uses "Waehrung")
  const hasWaehrung = norm.includes('währung') || norm.includes('waehrung');

  // Required fields
  const hasVerwendungszweck = norm.includes('verwendungszweck');
  const hasBetrag = norm.includes('betrag');

  // Strong match: has Vorgang (unique to Commerzbank)
  if (hasVorgang && hasVerwendungszweck && hasBetrag) {
    return {
      profileId: PROFILE_ID,
      confidence: 0.98, // High confidence due to unique "Vorgang" field
    };
  }

  // Good match: has Auftraggeber/Empfänger and Währung (distinctive from DKB)
  if (hasAuftraggeberEmpfaenger && hasWaehrung && hasVerwendungszweck && hasBetrag) {
    // Exclude DKB patterns
    const isDkb = norm.includes('begünstigter') || 
                  norm.includes('beguenstigter') || 
                  norm.includes('zahlungspflichtiger') ||
                  norm.includes('buchungstext');
    if (!isDkb) {
      return {
        profileId: PROFILE_ID,
        confidence: 0.97,
      };
    }
  }

  return null;

}

/**

 * Parse Commerzbank CSV into ParseResult.

 * Example header:

 * "Buchungstag";"Wertstellung";"Vorgang";"Verwendungszweck";"Auftraggeber/Empfänger";"IBAN";"Betrag";"Währung"

 */

export function parseCommerzbankCsv(buffer: Buffer): ParseResult {

  const { records } = parseBankCsvRecords(buffer);

  const warnings: string[] = [];

  const rows: ParsedRow[] = [];

  for (const record of records as Record<string, string>[]) {

    const normalizedMap: Record<string, string> = {};

    for (const [key, value] of Object.entries(record)) {

      normalizedMap[normalizeHeader(key)] = value;

    }

    const bookingRaw = normalizedMap['buchungstag'] || '';

    const valutaRaw = normalizedMap['wertstellung'] || '';

    const purpose = normalizedMap['verwendungszweck'] || '';

    const counterparty =

      normalizedMap['auftraggeber_empfänger'] ||

      normalizedMap['auftraggeber_empfaenger'] ||

      '';

    const iban = normalizedMap['iban'] || '';

    const amountRaw = normalizedMap['betrag'] || '';

    const currency =

      normalizedMap['wahrung'] ||

      normalizedMap['waehrung'] ||

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

    const externalId = buildCommerzbankExternalId({

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

      accountId: 'commerzbank:giro',

      accountIban: iban || null,

      counterparty: counterparty || null,

      counterpartyIban: iban || null,

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

    throw new Error('Commerzbank CSV: keine gültigen Buchungen gefunden.');

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

function buildCommerzbankExternalId(input: {

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

