import type { ParsedTransaction, BankId } from '../types.js';
import { pick, normalizeDate, normalizeAmount } from '../normalize.js';

/**
 * Deutsche Bank CSV parser
 * Headers: Buchungsdatum, Vorgang, Verwendungszweck, Betrag, etc.
 */
export function parse(rows: Record<string, string>[]): ParsedTransaction[] {
  return rows
    .map(row => {
      const bookingDate = normalizeDate(pick(row, ['Buchungsdatum', 'Buchungstag', 'Date']));
      if (!bookingDate) return null;
      
      const valueDate = normalizeDate(pick(row, ['Valutadatum', 'Valuta', 'Wertstellung']), true);
      const amountRaw = pick(row, ['Betrag', 'Umsatz', 'Betrag (EUR)', 'Betrag (Eur)']);
      const amount = normalizeAmount(amountRaw);
      const description = pick(row, ['Verwendungszweck', 'Buchungstext', 'Text', 'Vorgang']);
      const counterparty = pick(row, ['Auftraggeber', 'Empfänger', 'Name', 'Begünstigter/Zahlungspflichtiger']);
      const iban = pick(row, ['IBAN', 'Kontonummer']).replace(/\s+/g, '');
      const bic = pick(row, ['BIC', 'BLZ']);

      return {
        bank: 'deutsche-bank' as BankId,
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

