import { BankProfile, ParsedRow } from '../types';
import {
  buildRawText,
  headerScore,
  inferDirection,
  toAmountCents,
  toBookingDate,
  valueByIncludes,
  valueFor,
} from './utils';
import { normalizeHeader } from '../utils';

const HEADER_KEYWORDS = [
  'buchungstag',
  'betrag',
  'verwendungszweck',
  'auftraggeber',
  'wertstellung',
  'valutadatum',
  'beguenstigter',
  'zahlungspflichtiger',
  'buchungstext',
];

export const sparkasseProfile: BankProfile = {
  id: 'sparkasse',
  matches(headers, sampleRows) {
    const headerWeight = headerScore(headers, HEADER_KEYWORDS);
    const normalizedHeaders = headers.map(normalizeHeader);
    const hasSparkasseSignature =
      normalizedHeaders.some(header => header.includes('auftraggeber/beg')) &&
      normalizedHeaders.some(header => header.includes('währung'));
    const sample = sampleRows.slice(0, 3);
    let hits = 0;
    for (const row of sample) {
      const record: Record<string, string> = {};
      headers.forEach((header, idx) => {
        record[header] = row[idx] ?? '';
      });
      try {
        toAmountCents(
          valueByIncludes(record, ['betrag', 'umsatz', 'soll', 'haben', 'betrag (eur)', 'betrag eur']),
        );
        toBookingDate(valueByIncludes(record, ['buchungstag', 'datum']));
        hits += 1;
      } catch {
        continue;
      }
    }
    const sampleScore = sample.length ? hits / sample.length : 0;
    const baseScore = Math.min(1, headerWeight * 0.6 + sampleScore * 0.4);
    const bonus = hasSparkasseSignature ? 0.15 : 0;
    return Math.min(1, baseScore + bonus);
  },
  mapRow(record) {
    const bookingDateRaw = valueByIncludes(record, ['buchungstag', 'datum', 'buchungsdatum']);
    const valutaDateRaw = valueByIncludes(record, [
      'wertstellung',
      'valutadatum',
      'valuta',
      'wertstellung (valuta)',
    ]);
    if (!bookingDateRaw) {
      throw new Error('missing booking date');
    }
    const bookingDate = toBookingDate(bookingDateRaw);
    const valutaDate = valutaDateRaw ? toBookingDate(valutaDateRaw) : null;

    const amountRaw =
      valueByIncludes(record, ['betrag (eur)', 'betrag eur', 'umsatz in eur', 'umsatz', 'betrag']) ||
      buildSignedAmountFromSollHaben(record);
    if (!amountRaw) {
      throw new Error('missing amount');
    }
    const amountCents = toAmountCents(amountRaw);

    // Handle Sparkasse-specific counterparty fields
    const counterparty =
      valueByIncludes(record, [
        'auftraggeber',
        'empfaenger',
        'beguenstigter',
        'zahlungspflichtiger',
        'auftraggeber/empfaenger',
        'beguenstigter/zahlungspflichtiger',
      ]) ||
      valueFor(record, ['Name', 'Empfänger', 'Begünstigter/Zahlungspflichtiger', 'Auftraggeber/Empfänger']);

    const counterpartyIban =
      valueByIncludes(record, ['iban', 'kontonummer']) || valueFor(record, ['IBAN', 'Kontonummer']);

    // Extract reference from Verwendungszweck or Buchungstext
    const reference =
      valueByIncludes(record, ['verwendungszweck', 'buchungstext', 'vorgang']) ||
      valueFor(record, ['Beschreibung', 'Verwendungszweck', 'Buchungstext']);

    // Build comprehensive rawText from multiple fields
    const rawText = buildRawText(record, [
      'Buchungstext',
      'Verwendungszweck',
      'Begünstigter/Zahlungspflichtiger',
      'Auftraggeber/Empfänger',
      'Vorgang',
      'Beschreibung',
    ]);

    // Extract currency from Währung field if present, default to EUR
    const currencyRaw = valueByIncludes(record, ['waehrung', 'currency']) || valueFor(record, ['Währung', 'Currency']);
    const currency = (currencyRaw || 'EUR').toUpperCase().trim() || 'EUR';

    const parsed: ParsedRow = {
      bookingDate,
      valutaDate: valutaDate ?? bookingDate,
      amountCents,
      currency,
      direction: inferDirection(amountCents),
      accountId: 'bank:unknown',
      accountIban: null,
      counterparty: counterparty || null,
      counterpartyIban: counterpartyIban || null,
      mcc: null,
      reference: reference || null,
      rawText,
      raw: { ...record },
    };

    return parsed;
  },
};

function buildSignedAmountFromSollHaben(record: Record<string, string>): string {
  const soll = valueByIncludes(record, ['soll']);
  const haben = valueByIncludes(record, ['haben']);
  if (soll) {
    return `-${soll}`;
  }
  if (haben) {
    return haben;
  }
  return '';
}


