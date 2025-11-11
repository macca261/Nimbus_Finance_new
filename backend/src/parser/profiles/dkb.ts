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

const HEADER_KEYWORDS = ['buchungstag', 'verwendungszweck', 'betrag (eur)', 'wertstellung', 'auftragskonto'];

export const dkbProfile: BankProfile = {
  id: 'dkb',
  matches(headers, sampleRows) {
    const headerWeight = headerScore(headers, HEADER_KEYWORDS);
    const sample = sampleRows.slice(0, 3);
    let hits = 0;
    for (const row of sample) {
      const record: Record<string, string> = {};
      headers.forEach((header, idx) => {
        record[header] = row[idx] ?? '';
      });
      try {
        toAmountCents(valueByIncludes(record, ['betrag (eur)', 'betrag', 'umsatz']));
        toBookingDate(valueByIncludes(record, ['buchungstag']));
        hits += 1;
      } catch {
        continue;
      }
    }
    const sampleScore = sample.length ? hits / sample.length : 0;
    return Math.min(1, headerWeight * 0.65 + sampleScore * 0.35);
  },
  mapRow(record) {
    const bookingDateRaw = valueByIncludes(record, ['buchungstag']);
    if (!bookingDateRaw) {
      throw new Error('missing booking date');
    }
    const bookingDate = toBookingDate(bookingDateRaw);
    const valutaDateRaw = valueByIncludes(record, ['wertstellung']);
    const valutaDate = valutaDateRaw ? toBookingDate(valutaDateRaw) : null;

    const amountRaw =
      valueByIncludes(record, ['betrag (eur)', 'betrag', 'umsatz', 'betrag eur']) ||
      valueByIncludes(record, ['betrag in eur']);
    if (!amountRaw) {
      throw new Error('missing amount');
    }
    const amountCents = toAmountCents(amountRaw);

    const counterparty =
      valueByIncludes(record, ['auftraggeber', 'zahlungspflichtiger', 'name', 'gegenkonto']) ||
      valueFor(record, ['Gegenkonto']);
    const counterpartyIban = valueByIncludes(record, ['iban', 'gegenkonto iban']);
    const reference =
      valueByIncludes(record, ['verwendungszweck', 'buchungstext', 'zweck']) ||
      valueFor(record, ['Beschreibung']);

    const rawText = buildRawText(record, [
      'Verwendungszweck',
      'Buchungstext',
      'Zweck',
      'Beschreibung',
      'Info',
    ]);

    const parsed: ParsedRow = {
      bookingDate,
      valutaDate: valutaDate ?? bookingDate,
      amountCents,
      currency: 'EUR',
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


