/**
 * ING (DiBa) CSV Import Strategy
 * 
 * Handles ING CSV exports with:
 * - Semicolon delimiter
 * - ISO-8859-1 encoding
 * - German number format
 * - German date format
 */

import { ImportStrategy, NormalizedTransaction } from '../interfaces';
import { parseGermanDate, parseGermanNumber, generateHashId } from '../utils';

export class IngStrategy implements ImportStrategy {
  name = 'ING';
  priority = 100;
  
  csvOptions = {
    separator: ';',
    encoding: 'latin1' as const,
    skipLines: 0,
  };

  canParse(headers: string[]): boolean {
    const headerStr = headers.join(' ').toUpperCase();
    return (
      headerStr.includes('AUFTRAGGEBER/BEGÜNSTIGTER') &&
      headerStr.includes('BUCHUNGSTEXT')
    );
  }

  mapRow(row: Record<string, string>): NormalizedTransaction | null {
    // Date from "Buchung" or "Wertstellung"
    const dateField = row['Buchung'] || row['Wertstellung'] || '';
    const date = parseGermanDate(dateField);
    if (!date) return null;

    // Amount in "Betrag"
    const amountRaw = row['Betrag'] || '';
    const amountCents = parseGermanNumber(amountRaw);
    if (amountCents === 0 && !amountRaw) return null;

    // Payee from "Auftraggeber/Begünstigter"
    const payee = row['Auftraggeber/Begünstigter'] || 'Unknown';

    // Description from "Buchungstext"
    const description = row['Buchungstext'] || '';

    const currency = row['Währung'] || 'EUR';

    const hashId = generateHashId(date, amountCents, payee, description);

    return {
      date,
      amountCents,
      payee: payee.trim(),
      description: description.trim(),
      currency,
      externalId: null,
      hashId,
    };
  }
}

