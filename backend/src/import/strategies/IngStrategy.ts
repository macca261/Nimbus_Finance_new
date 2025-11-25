/**
 * ING (DiBa) CSV Import Strategy
 * 
 * Detects ING CSV exports by headers:
 * - "Auftraggeber/Empfänger"
 * - "Buchungstext"
 * 
 * Format:
 * - Separator: semicolon (;)
 * - Encoding: Usually ISO-8859-1 (latin1)
 * - Number format: German (1.234,56) but sometimes with "€" suffix
 * - Date format: DD.MM.YYYY
 */

import { ImportStrategy, NormalizedTransaction } from './ImportStrategy';
import { parseGermanNumber, parseGermanDate, generateSyntheticId } from '../utils';
import { cleanPayee } from '../utils/payeeCleaner';

export class IngStrategy implements ImportStrategy {
  name = 'ING';

  csvOptions = {
    separator: ';',
    skipLines: 0,
    encoding: 'latin1' as const,
  };

  matches(headers: string): boolean {
    const upper = headers.toUpperCase();
    return (
      (upper.includes('AUFTRAGGEBER/EMPFÄNGER') || upper.includes('AUFTRAGGEBER')) &&
      upper.includes('BUCHUNGSTEXT')
    );
  }

  mapRow(row: any): NormalizedTransaction | null {
    // Required fields
    const dateStr = row['Buchungstag'] || row['Valutadatum'] || '';
    const amountStr = row['Betrag'] || row['Umsatz'] || '';
    const payee = row['Auftraggeber/Empfänger'] || row['Auftraggeber'] || row['Empfänger'] || '';
    
    // Skip empty rows
    if (!dateStr || !amountStr) {
      return null;
    }

    // Parse date
    const date = parseGermanDate(dateStr);
    
    // Parse amount - ING often adds "€" suffix, strip it first
    const cleanedAmount = amountStr.replace(/€/g, '').trim();
    const amountCents = parseGermanNumber(cleanedAmount);
    
    // Skip zero amounts
    if (amountCents === 0) {
      return null;
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
