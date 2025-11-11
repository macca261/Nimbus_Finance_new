import type { ParsedTransaction, BankId } from '../types.js';
import { pick, normalizeDate, normalizeAmount } from '../normalize.js';

/**
 * Sparkasse CSV parser
 * Headers: Buchungstag, Valutadatum, Betrag, Verwendungszweck, Auftraggeber/Empfänger, etc.
 */
export function parse(rows: Record<string, string>[]): ParsedTransaction[] {
  return rows
    .map(row => {
      const bookingDate = normalizeDate(pick(row, ['Buchungstag', 'Buchungsdatum', 'Date']));
      if (!bookingDate) return null;
      
      const valueDate = normalizeDate(pick(row, ['Valutadatum', 'Valuta', 'Wertstellung', 'Wertstellung (Valuta)']), true);
      const amountRaw = pick(row, ['Betrag', 'Umsatz', 'Betrag (EUR)']);
      const amount = normalizeAmount(amountRaw);
      const purpose = pick(row, ['Verwendungszweck', 'Buchungstext', 'Text']);
      const counterparty = pick(row, ['Auftraggeber/Empfänger', 'Begünstigter/Zahlungspflichtiger', 'Empfänger', 'Name']);
      const description = [counterparty, purpose].filter(Boolean).join(' - ') || purpose;
      const iban = pick(row, ['IBAN', 'Kontonummer']).replace(/\s+/g, '');
      const bic = pick(row, ['BIC', 'BLZ']);

      return {
        bank: 'sparkasse' as BankId,
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

