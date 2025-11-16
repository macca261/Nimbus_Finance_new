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
import { stripBankReference } from '../../categorization/textPreprocessor';

const HEADER_KEYWORDS = ['buchung', 'wertstellung', 'betrag', 'verwendungszweck', 'gegenkonto'];

export const ingProfile: BankProfile = {
  id: 'ing',
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
        toAmountCents(valueByIncludes(record, ['betrag', 'umsatz']));
        toBookingDate(valueByIncludes(record, ['buchung', 'buchungstag']));
        hits += 1;
      } catch {
        continue;
      }
    }
    const sampleScore = sample.length ? hits / sample.length : 0;
    return Math.min(1, headerWeight * 0.6 + sampleScore * 0.4);
  },
  mapRow(record) {
    const bookingDateRaw = valueByIncludes(record, ['buchung', 'buchungstag', 'datum']);
    if (!bookingDateRaw) throw new Error('missing booking date');
    const bookingDate = toBookingDate(bookingDateRaw);

    const valutaDateRaw = valueByIncludes(record, ['wertstellung']);
    const valutaDate = valutaDateRaw ? toBookingDate(valutaDateRaw) : null;

    const amountRaw = valueByIncludes(record, ['betrag', 'umsatz', 'betrag in eur']);
    if (!amountRaw) throw new Error('missing amount');
    const amountCents = toAmountCents(amountRaw);

    const counterparty =
      valueByIncludes(record, ['gegenkonto', 'auftraggeber', 'empfaenger', 'beguenstigter']) ||
      valueFor(record, ['Name']);
    const counterpartyIban = valueByIncludes(record, ['gegenkonto iban', 'iban']);
    const reference =
      valueByIncludes(record, ['verwendungszweck', 'text', 'buchungstext']) ||
      valueFor(record, ['Beschreibung']);

    const rawTextOriginal = buildRawText(record, ['Verwendungszweck', 'Buchungstext', 'Text', 'Beschreibung']);
    
    // Extract bank reference ID and clean text
    const { cleanText: rawText, bankReferenceId } = stripBankReference(rawTextOriginal);

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
      bankReferenceId: bankReferenceId || null,
      raw: { ...record },
    };

    return parsed;
  },
};


