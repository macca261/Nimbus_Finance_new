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

const HEADER_KEYWORDS = ['buchungstag', 'wertstellung', 'umsatz in eur', 'buchungstext'];

export const comdirectProfile: BankProfile = {
  id: 'comdirect',
  matches(headers, sampleRows) {
    const headerWeight = headerScore(headers, HEADER_KEYWORDS);
    const sample = sampleRows.slice(0, 3);
    let parseHits = 0;
    for (const row of sample) {
      const record: Record<string, string> = {};
      headers.forEach((header, idx) => {
        record[header] = row[idx] ?? '';
      });
      try {
        const amount = valueByIncludes(record, ['umsatz in eur', 'betrag']);
        const date = valueByIncludes(record, ['buchungstag']);
        toAmountCents(amount);
        toBookingDate(date);
        parseHits += 1;
      } catch {
        continue;
      }
    }
    const sampleScore = sample.length ? parseHits / sample.length : 0;
    return Math.min(1, headerWeight * 0.7 + sampleScore * 0.3);
  },
  mapRow(record) {
    const bookingDateRaw = valueByIncludes(record, ['buchungstag']);
    const valutaDateRaw = valueByIncludes(record, ['wertstellung']);
    const amountRaw = valueByIncludes(record, ['umsatz in eur', 'betrag']);
    if (!bookingDateRaw || !amountRaw) {
      throw new Error('missing required fields');
    }
    const bookingDate = toBookingDate(bookingDateRaw);
    const amountCents = toAmountCents(amountRaw);
    const valutaDate = valutaDateRaw ? toBookingDate(valutaDateRaw) : null;

    const counterparty =
      valueFor(record, ['Auftraggeber/Empfänger', 'Begünstigter', 'Empfänger']) ||
      valueByIncludes(record, ['auftraggeber', 'empfänger', 'beguenstigter']);
    const counterpartyIban = valueByIncludes(record, ['iban']);
    const reference = valueByIncludes(record, ['verwendungszweck', 'buchungstext', 'vorgang']);

    const rawText = buildRawText(record, [
      'Buchungstext',
      'Vorgang',
      'Verwendungszweck',
      'Notiz',
      'Kategorie',
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


