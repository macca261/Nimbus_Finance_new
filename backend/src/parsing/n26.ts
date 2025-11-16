import type { DetectionCandidate, ParseResult, ParsedRow } from './types';

import {

  parseBankCsvRecords,

  parseGermanDateToIso,

  parseGermanMoneyToCents,

  directionFromAmount,

} from './bankCommon';

import { normalizeHeader } from '../utils/header';

const PROFILE_ID = 'n26';

/**

 * N26 CSV detection.

 * Typical header (German or English):

 * - "Datum"/"Date"

 * - "Empfänger"/"Payee"

 * - "Kontonummer"/"Account number"

 * - "Betrag (EUR)"/"Amount (EUR)"

 */

export function detectN26Csv(text: string): DetectionCandidate | null {

  const lines = text.split(/\r?\n/).slice(0, 10);

  if (lines.length === 0) return null;

  const headerLine = lines.find((line) => {

    const l = line.toLowerCase();

    return (l.includes('datum') || l.includes('date')) &&

      (l.includes('empfänger') || l.includes('empfaenger') || l.includes('payee')) &&

      (l.includes('betrag') || l.includes('amount')) &&

      (l.includes('eur'));

  });

  if (!headerLine) return null;

  return {

    profileId: PROFILE_ID,

    confidence: 0.95,

  };

}

export function parseN26Csv(buffer: Buffer): ParseResult {

  const { records } = parseBankCsvRecords(buffer);

  const warnings: string[] = [];

  const rows: ParsedRow[] = [];

  for (const record of records as Record<string, string>[]) {

    const normalizedMap: Record<string, string> = {};

    for (const [key, value] of Object.entries(record)) {

      normalizedMap[normalizeHeader(key)] = value;

    }

    const bookingRaw =

      normalizedMap['datum'] ||

      normalizedMap['date'] ||

      '';

    const valutaRaw =

      normalizedMap['valuta'] ||

      ''; // often not present; keep empty

    // normalizeHeader converts to lowercase and normalizes spaces, but keeps spaces
    // "Payment reference" -> "payment reference"
    // "Amount (EUR)" -> "amount (eur)"
    const purpose =

      normalizedMap['verwendungszweck'] ||

      normalizedMap['payment reference'] || // "Payment reference" normalizes to this

      normalizedMap['payment_reference'] ||

      normalizedMap['reference'] ||

      '';

    const counterparty =

      normalizedMap['empfänger'] ||

      normalizedMap['empfaenger'] ||

      normalizedMap['payee'] ||

      '';

    const accountNumber =

      normalizedMap['kontonummer'] ||

      normalizedMap['account number'] || // "Account number" normalizes to this

      normalizedMap['account_number'] ||

      '';

    const amountRaw =

      normalizedMap['betrag (eur)'] ||

      normalizedMap['betrag_eur'] ||

      normalizedMap['amount (eur)'] || // "Amount (EUR)" normalizes to this

      normalizedMap['amount_eur'] ||

      normalizedMap['amount'] ||

      '';

    const currency = normalizedMap['currency'] || normalizedMap['währung'] || normalizedMap['waehrung'] || 'EUR';

    // Handle ISO date format (YYYY-MM-DD or YYYY-MM-DD HH:MM) in addition to German format
    let bookingDate: string | null = null;
    if (bookingRaw) {
      // Try ISO format first (N26 exports use this)
      const isoMatch = bookingRaw.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+\d{2}:\d{2})?$/);
      if (isoMatch) {
        const [, yyyy, mm, dd] = isoMatch;
        bookingDate = `${yyyy}-${mm}-${dd}`;
      } else {
        // Fall back to German format parser
        bookingDate = parseGermanDateToIso(bookingRaw);
      }
    }

    if (!bookingDate) {

      warnings.push(

        `Zeile übersprungen: ungültiges Buchungsdatum "${bookingRaw}".`,

      );

      continue;

    }

    let valutaDate: string | null = bookingDate;
    if (valutaRaw) {
      const isoMatch = valutaRaw.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+\d{2}:\d{2})?$/);
      if (isoMatch) {
        const [, yyyy, mm, dd] = isoMatch;
        valutaDate = `${yyyy}-${mm}-${dd}`;
      } else {
        valutaDate = parseGermanDateToIso(valutaRaw) || bookingDate;
      }
    }

    // N26 uses English format (dot as decimal separator) like "-8.79" or "2500.00"
    // parseGermanMoneyToCents should handle this, but let's ensure it works
    let amountCents: number | null = parseGermanMoneyToCents(amountRaw);
    
    // If German parser fails, try English format directly
    if (amountCents === null && amountRaw) {
      const cleaned = amountRaw.replace(/["\s]/g, '');
      const negative = cleaned.startsWith('-');
      const numStr = cleaned.replace(/[^\d.]/g, '');
      const parsed = Number.parseFloat(numStr);
      if (Number.isFinite(parsed) && parsed !== 0) {
        amountCents = Math.round(parsed * 100);
        if (negative) amountCents = -Math.abs(amountCents);
      }
    }

    if (amountCents === null || amountCents === 0) {

      warnings.push('Zeile übersprungen: Betrag 0 oder nicht lesbar.');

      continue;

    }

    const direction = directionFromAmount(amountCents);

    const rawTextParts = [purpose, counterparty].filter(Boolean);

    const rawText = rawTextParts.join(' | ');

    const externalId = buildN26ExternalId({

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

      accountId: 'n26:main',

      accountIban: accountNumber || null,

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

    throw new Error('N26 CSV: keine gültigen Buchungen gefunden.');

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

function buildN26ExternalId(input: {

  bookingDate: string;

  amountCents: number;

  currency: string;

  purpose: string;

  counterparty: string;

  normalizedMap: Record<string, string>;

}): string {

  const txId =

    input.normalizedMap['transaction_id'] ||

    input.normalizedMap['id'] ||

    '';

  if (txId) {

    return `${PROFILE_ID}-${txId}`;

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

