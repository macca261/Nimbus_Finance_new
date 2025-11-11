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

const HEADER_KEYWORDS = ['buchung', 'datum', 'betrag', 'verwendungszweck'];

export const genericDeProfile: BankProfile = {
  id: 'generic_de',
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
        toAmountCents(
          valueByIncludes(record, ['betrag', 'umsatz', 'betrag in eur', 'soll', 'haben']) ||
            buildSignedAmount(record),
        );
        toBookingDate(valueByIncludes(record, ['buchung', 'datum']));
        hits += 1;
      } catch {
        continue;
      }
    }
    const sampleScore = sample.length ? hits / sample.length : 0;
    return Math.max(0.2, Math.min(0.85, headerWeight * 0.5 + sampleScore * 0.5));
  },
  mapRow(record) {
    const bookingDateRaw = valueByIncludes(record, ['buchung', 'buchungstag', 'datum']);
    if (!bookingDateRaw) throw new Error('missing booking date');
    const bookingDate = toBookingDate(bookingDateRaw);

    const valutaDateRaw = valueByIncludes(record, ['wertstellung', 'valuta']);
    const valutaDate = valutaDateRaw ? toBookingDate(valutaDateRaw) : null;

    const rawAmount =
      valueByIncludes(record, ['betrag', 'umsatz', 'betrag in eur']) || buildSignedAmount(record);
    if (!rawAmount) throw new Error('missing amount');
    const amountCents = toAmountCents(rawAmount);

    const counterparty =
      valueByIncludes(record, ['auftraggeber', 'empfaenger', 'gegenkonto', 'name']) ||
      valueFor(record, ['Name']);
    const counterpartyIban = valueByIncludes(record, ['iban', 'gegenkonto iban']);
    const reference =
      valueByIncludes(record, ['verwendungszweck', 'buchungstext', 'beschreibung', 'zweck']) ||
      valueFor(record, ['Beschreibung']);

    const rawText = buildRawText(record, [
      'Verwendungszweck',
      'Buchungstext',
      'Beschreibung',
      'Zweck',
      'Text',
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

function buildSignedAmount(record: Record<string, string>): string {
  const soll = valueByIncludes(record, ['soll']);
  if (soll) return `-${soll}`;
  const haben = valueByIncludes(record, ['haben']);
  if (haben) return haben;
  return '';
}


