/**
 * DKB (Old Format) CSV Import Strategy
 * 
 * Detects old DKB CSV exports (pre-2024) by headers:
 * - "Mandatsreferenz" AND "Gläubiger-ID"
 * 
 * Format:
 * - Separator: semicolon (;)
 * - Encoding: ISO-8859-1 (latin1)
 * - Number format: German (1.234,56)
 * - Date format: DD.MM.YYYY
 */

import { ImportStrategy, NormalizedTransaction } from './ImportStrategy';
import { parseGermanNumber, parseGermanDate } from '../utils';
import { cleanPayee } from '../utils/payeeCleaner';

export class DKBOldStrategy implements ImportStrategy {
  name = 'DKB (Old Format)';

  csvOptions = {
    separator: ';',
    skipLines: 0,
    encoding: 'latin1' as const,
  };

  matches(headers: string): boolean {
    const upper = headers.toUpperCase();
    return (
      upper.includes('MANDATSREFERENZ') &&
      upper.includes('GLÄUBIGER-ID')
    );
  }

  mapRow(row: any): NormalizedTransaction | null {
    // Required fields
    const dateStr = row['Buchungstag'] || row['Valutadatum'] || '';
    const amountStr = row['Betrag'] || row['Umsatz'] || '';
    const payee = row['Begünstigter'] || row['Empfänger'] || '';
    
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

