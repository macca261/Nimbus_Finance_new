/**
 * Sparkasse CSV Import Strategy
 * 
 * Detects Sparkasse CSV exports by headers:
 * - "Begünstigter/Zahlungspflichtiger"
 * - "Valutadatum"
 * 
 * Format:
 * - Separator: semicolon (;)
 * - Encoding: Usually ISO-8859-1 (latin1)
 * - Number format: German (1.234,56)
 * - Date format: DD.MM.YY or DD.MM.YYYY
 */

import { ImportStrategy, NormalizedTransaction } from './ImportStrategy';
import { parseGermanNumber, parseGermanDate, generateSyntheticId } from '../utils';
import { cleanPayee } from '../utils/payeeCleaner';

export class SparkasseStrategy implements ImportStrategy {
  name = 'Sparkasse';

  csvOptions = {
    separator: ';',
    skipLines: 0,
    encoding: 'latin1' as const,
  };

  matches(headers: string): boolean {
    const upper = headers.toUpperCase();
    return (
      upper.includes('BEGÜNSTIGTER/ZAHLUNGSPFLICHTIGER') &&
      upper.includes('VALUTADATUM')
    );
  }

  mapRow(row: any): NormalizedTransaction | null {
    // Required fields
    const dateStr = row['Buchungstag'] || row['Valutadatum'] || row['Buchungstag'] || '';
    const amountStr = row['Betrag'] || row['Umsatz'] || '';
    const payee = row['Begünstigter/Zahlungspflichtiger'] || row['Begünstigter'] || '';
    
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

    // Description
    const description = row['Verwendungszweck'] || row['Verwendungszweck/Zweck'] || '';

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
