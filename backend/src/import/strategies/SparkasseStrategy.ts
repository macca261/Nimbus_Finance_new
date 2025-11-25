/**
 * Sparkasse CSV Import Strategy
 * 
 * Handles Sparkasse CSV exports with:
 * - Semicolon delimiter
 * - ISO-8859-1 encoding (critical for Umlauts)
 * - German number format (1.000,50)
 * - German date format (DD.MM.YY)
 */

import { ImportStrategy, NormalizedTransaction } from '../interfaces';
import { parseGermanDate, parseGermanNumber, generateHashId } from '../utils';

export class SparkasseStrategy implements ImportStrategy {
  name = 'Sparkasse';
  priority = 100; // High priority (specific bank)
  
  csvOptions = {
    separator: ';',
    encoding: 'latin1' as const, // Critical for Umlauts (Müller, etc.)
    skipLines: 0,
  };

  canParse(headers: string[]): boolean {
    const headerStr = headers.join(' ').toUpperCase();
    return (
      headerStr.includes('BEGÜNSTIGTER/ZAHLUNGSPFLICHTIGER') &&
      (headerStr.includes('VALUTADATUM') || headerStr.includes('Buchungstag'))
    );
  }

  mapRow(row: Record<string, string>): NormalizedTransaction | null {
    // Sparkasse uses "Begünstigter/Zahlungspflichtiger" for payee
    const payeeField = row['Begünstigter/Zahlungspflichtiger'] || 
                       row['Auftraggeber/Empfänger'] || 
                       '';
    
    // Date can be in "Buchungstag" or "Valutadatum"
    const dateField = row['Buchungstag'] || row['Valutadatum'] || '';
    const date = parseGermanDate(dateField);
    if (!date) return null;

    // Amount in "Betrag" field
    const amountRaw = row['Betrag'] || '';
    const amountCents = parseGermanNumber(amountRaw);
    if (amountCents === 0 && !amountRaw) return null; // Skip empty rows

    // Description from "Verwendungszweck"
    const description = row['Verwendungszweck'] || '';
    
    // Currency (usually EUR, but check "Währung" field)
    const currency = row['Währung'] || 'EUR';

    // Clean payee (remove extra whitespace)
    const payee = payeeField.trim() || 'Unknown';

    // Generate hash for deduplication
    const hashId = generateHashId(date, amountCents, payee, description);

    return {
      date,
      amountCents,
      payee,
      description,
      currency,
      externalId: null, // Sparkasse CSVs rarely have stable transaction IDs
      hashId,
    };
  }
}

