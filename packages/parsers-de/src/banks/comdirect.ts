import type { ParsedTransaction, BankId } from '../types.js';
import { pick, normalizeDate, normalizeAmount } from '../normalize.js';

/**
 * Comdirect CSV parser
 * Headers: Buchungstag, Buchungstext, Umsatz in EUR, Wertstellung (Valuta), etc.
 */
export function parse(rows: Record<string, string>[]): ParsedTransaction[] {
  return rows
    .map(row => {
      const bookingDate = normalizeDate(pick(row, ['Buchungstag', 'Buchungsdatum', 'Date']));
      if (!bookingDate) return null;
      
      const valueDate = normalizeDate(pick(row, ['Wertstellung', 'Valuta', 'Wertstellung (Valuta)']), true);
      const amountRaw = pick(row, ['Umsatz in EUR', 'Umsatz (EUR)', 'Betrag (EUR)', 'Betrag', 'Umsatz']);
      const amount = normalizeAmount(amountRaw);
      const description = pick(row, ['Buchungstext', 'Verwendungszweck', 'Text']);
      const counterparty = pick(row, ['Gegenkonto', 'Empfänger', 'Name', 'Begünstigter/Zahlungspflichtiger']);
      const iban = pick(row, ['IBAN', 'Auftragskonto']).replace(/\s+/g, '');
      const bic = pick(row, ['BIC']);

      return {
        bank: 'comdirect' as BankId,
        bookingDate,
        ...(valueDate && { valueDate }),
        amount,
        currency: 'EUR' as const,
        description,
        ...(counterparty && { counterparty }),
        ...(iban && { iban }),
        ...(bic && { bic }),
        raw: row,
      } as ParsedTransaction;
    })
    .filter((t): t is ParsedTransaction => t !== null);
}

