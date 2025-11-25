/**
 * DKB (Deutsche Kreditbank) CSV Import Strategy
 * 
 * Detects DKB CSV exports by headers:
 * - "Zahlungsempfänger*in" (2024 format)
 * 
 * Format:
 * - Separator: semicolon (;)
 * - Encoding: Usually ISO-8859-1 (latin1)
 * - Number format: German (1.234,56)
 * - Date format: DD.MM.YYYY
 * 
 * Special handling:
 * - For expenses (negative): Payee = "Zahlungsempfänger*in"
 * - For income (positive): Payee = "Zahlungspflichtige*r"
 */

import { ImportStrategy, NormalizedTransaction } from './ImportStrategy';
import { parseGermanNumber, parseGermanDate, generateSyntheticId } from '../utils';
import { cleanPayee } from '../utils/payeeCleaner';

export class DKBStrategy implements ImportStrategy {
  name = 'DKB';

  csvOptions = {
    separator: ';',
    skipLines: 0,
    encoding: 'latin1' as const,
  };

  matches(headers: string): boolean {
    const upper = headers.toUpperCase();
    return (
      upper.includes('ZAHLUNGSEMPFÄNGER') ||
      upper.includes('ZAHLUNGSPFLICHTIGE') ||
      (upper.includes('EMPFÄNGER') && upper.includes('DKB'))
    );
  }

  mapRow(row: any): NormalizedTransaction | null {
    // Required fields
    const dateStr = row['Buchungstag'] || row['Valutadatum'] || '';
    const amountStr = row['Betrag'] || row['Umsatz'] || '';
    
    // Skip empty rows
    if (!dateStr || !amountStr) {
      return null;
    }

    // Parse date
    const date = parseGermanDate(dateStr);
    
    // Parse amount (German format)
    const amountCents = parseGermanNumber(amountStr);
    
    // Skip zero amounts
    if (amountCents === 0) {
      return null;
    }

    // DKB splits payee columns based on transaction direction
    let payee: string;
    if (amountCents < 0) {
      // Expense: use "Zahlungsempfänger*in"
      payee = row['Zahlungsempfänger*in'] || row['Zahlungsempfänger'] || row['Empfänger'] || '';
    } else {
      // Income: use "Zahlungspflichtige*r"
      payee = row['Zahlungspflichtige*r'] || row['Zahlungspflichtiger'] || row['Auftraggeber'] || '';
    }

    // Fallback if neither column exists
    if (!payee) {
      payee = row['Empfänger'] || row['Auftraggeber'] || 'Unbekannt';
    }

    // Description
    const description = row['Verwendungszweck'] || row['Buchungstext'] || '';

    // Clean payee
    const cleanedPayee = cleanPayee(payee);

    // Generate synthetic ID
    const externalId = generateSyntheticId(date, amountCents, cleanedPayee);

    return {
      date,
      amountCents,
      payee: cleanedPayee || 'Unbekannt',
      description: description.trim(),
      currency: 'EUR',
      externalId,
    };
  }
}
