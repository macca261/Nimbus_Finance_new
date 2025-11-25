/**
 * Commerzbank CSV Import Strategy
 * 
 * Detects Commerzbank CSV exports by headers:
 * - "Umsatzart" AND "IBAN Auftraggeberkonto"
 * 
 * Format:
 * - Separator: semicolon (;)
 * - Encoding: UTF-8
 * - Number format: German (1.234,56)
 * - Date format: DD.MM.YYYY
 */

import { ImportStrategy, NormalizedTransaction } from './ImportStrategy';
import { parseGermanNumber, parseGermanDate } from '../utils';
import { cleanPayee } from '../utils/payeeCleaner';

export class CommerzbankStrategy implements ImportStrategy {
  name = 'Commerzbank';

  csvOptions = {
    separator: ';',
    skipLines: 0,
    encoding: 'utf-8' as const,
  };

  matches(headers: string): boolean {
    const upper = headers.toUpperCase();
    return (
      upper.includes('UMSATZART') &&
      (upper.includes('IBAN AUFTRAGGEBERKONTO') || upper.includes('IBAN'))
    );
  }

  mapRow(row: any): NormalizedTransaction | null {
    // Required fields
    const dateStr = row['Buchungstag'] || row['Valutadatum'] || '';
    const amountStr = row['Betrag'] || row['Umsatz'] || '';
    const payee = row['Begünstigter/Zahlungspflichtiger'] || row['Empfänger'] || '';
    
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
    const description = row['Verwendungszweck'] || row['Buchungstext'] || '';

    // Clean payee
    const cleanedPayee = cleanPayee(payee || description);

    // Generate synthetic ID
    const crypto = require('crypto');
    const hashInput = `${date}|${amountCents}|${cleanedPayee}`;
    const externalId = crypto.createHash('md5').update(hashInput, 'utf-8').digest('hex');

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

