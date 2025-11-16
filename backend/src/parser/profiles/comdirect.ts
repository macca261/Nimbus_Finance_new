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
    
    // Extract IBAN from purpose text (comdirect embeds IBAN in Buchungstext like "IBAN: DE32200411770270381700")
    const reference = valueByIncludes(record, ['verwendungszweck', 'buchungstext', 'vorgang']);
    const purposeText = reference || '';
    
    // Try to extract IBAN from a dedicated column first
    let counterpartyIban = valueByIncludes(record, ['iban']);
    
    // If not found in column, extract from purpose text (comdirect format: "IBAN: DE32200411770270381700")
    if (!counterpartyIban && purposeText) {
      // Match German IBAN pattern: DE followed by 20 digits
      // Also handle formats like "Kto/IBAN: DE32200411770270381700" or "IBAN: DE32200411770270381700"
      const ibanMatch = purposeText.match(/\b(?:IBAN|Kto\/IBAN|Konto\/IBAN)[:\s]+(DE[0-9]{20})\b/i);
      if (ibanMatch && ibanMatch[1]) {
        counterpartyIban = ibanMatch[1].toUpperCase();
      }
    }

    const rawTextOriginal = buildRawText(record, [
      'Buchungstext',
      'Vorgang',
      'Verwendungszweck',
      'Notiz',
      'Kategorie',
    ]);
    
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


