import type { DetectionCandidate, ParseResult, ParsedRow } from './types';

import {

  parseBankCsvRecords,

  parseGermanDateToIso,

  parseGermanMoneyToCents,

  directionFromAmount,

} from './bankCommon';

import { normalizeHeader } from '../utils/header';

const PROFILE_ID = 'deutsche_bank';

/**

 * Detection for Deutsche Bank CSV.

 *

 * Real-world header example (from fixtures):

 * "Buchungstag";"Wertstellung";"Buchungstext";"Verwendungszweck";

 * "Auftraggeber / Empfänger";"IBAN";"Umsatz in EUR";"Währung"

 */

export function detectDeutscheBankCsv(text: string): DetectionCandidate | null {

  const lines = text.split(/\r?\n/).slice(0, 10);

  if (lines.length === 0) return null;

  const headerLine = lines.find((line) =>

    line.toLowerCase().includes('buchungstag'),

  );

  if (!headerLine) return null;

  const norm = headerLine.toLowerCase();

  const looksLike =

    norm.includes('verwendungszweck') &&

    // Deutsche Bank uses "Umsatz in EUR" in our fixture

    (norm.includes('umsatz in eur') || norm.includes('umsatz_in_eur') || norm.includes('umsatz')) &&

    // Counterparty column is "Auftraggeber / Empfänger"

    (norm.includes('auftraggeber') || norm.includes('empfänger') || norm.includes('empfaenger'));

  if (!looksLike) return null;

  return {

    profileId: PROFILE_ID,

    confidence: 0.97,

  };

}

/**

 * Parse Deutsche Bank CSV into ParseResult.

 *

 * Header example:

 * "Buchungstag";"Wertstellung";"Buchungstext";"Verwendungszweck";

 * "Auftraggeber / Empfänger";"IBAN";"Umsatz in EUR";"Währung"

 */

export function parseDeutscheBankCsv(buffer: Buffer): ParseResult {

  const { records } = parseBankCsvRecords(buffer);

  const warnings: string[] = [];

  const rows: ParsedRow[] = [];

  for (const record of records as Record<string, string>[]) {

    const normalizedMap: Record<string, string> = {};

    for (const [key, value] of Object.entries(record)) {

      normalizedMap[normalizeHeader(key)] = value;

    }

    const bookingRaw =

      normalizedMap['buchungstag'] ||

      normalizedMap['datum'] ||

      '';

    const valutaRaw =

      normalizedMap['wertstellung'] ||

      normalizedMap['valuta'] ||

      '';

    const purpose =

      normalizedMap['verwendungszweck'] ||

      normalizedMap['buchungstext'] ||

      '';

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

      // Real header is "Umsatz in EUR" → normalizeHeader keeps spaces: "umsatz in eur"

      normalizedMap['umsatz in eur'] ||

      normalizedMap['umsatz_in_eur'] ||

      normalizedMap['umsatz'] ||

      normalizedMap['betrag'] ||

      normalizedMap['betrag_eur'] ||

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

    const externalId = buildDeutscheBankExternalId({

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

      accountId: 'deutsche_bank:giro',

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

    throw new Error('Deutsche Bank CSV: keine gültigen Buchungen gefunden.');

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

function buildDeutscheBankExternalId(input: {

  bookingDate: string;

  amountCents: number;

  currency: string;

  purpose: string;

  counterparty: string;

  normalizedMap: Record<string, string>;

}): string {

  const ref =

    input.normalizedMap['kundenreferenz'] ||

    input.normalizedMap['kundenreferenz_end_to_end'] ||

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
