/**
 * N26 CSV Import Strategy
 * 
 * Detects N26 CSV exports by headers:
 * - "Verwendungszweck" AND "Betrag (EUR)"
 * 
 * Format:
 * - Separator: comma (,)
 * - Encoding: UTF-8
 * - Number format: International (1,234.56) or German (1.234,56) - auto-detect
 * - Date format: DD.MM.YYYY or YYYY-MM-DD
 */

import { ImportStrategy, NormalizedTransaction } from './ImportStrategy';
import { parseNumberAuto, parseGermanDate } from '../utils';
import { cleanPayee } from '../utils/payeeCleaner';

export class N26Strategy implements ImportStrategy {
  name = 'N26';

  csvOptions = {
    separator: ',',
    skipLines: 0,
    encoding: 'utf-8' as const,
  };

  matches(headers: string): boolean {
    const upper = headers.toUpperCase();
    return (
      upper.includes('VERWENDUNGSZWECK') &&
      (upper.includes('BETRAG') || upper.includes('BETRAG (EUR)'))
    );
  }

  mapRow(row: any): NormalizedTransaction | null {
    // Required fields
    const dateStr = row['Datum'] || row['Buchungsdatum'] || row['Datum der Buchung'] || '';
    const amountStr = row['Betrag (EUR)'] || row['Betrag'] || row['Amount'] || '';
    const payee = row['Empfänger'] || row['Begünstigter'] || row['Payee'] || '';
    
    // Skip empty rows
    if (!dateStr || !amountStr) {
      return null;
    }

    // Parse date
    const date = parseGermanDate(dateStr);
    
    // Parse amount (auto-detect format)
    const amountCents = parseNumberAuto(amountStr);
    
    // Skip zero amounts
    if (amountCents === 0) {
      return null;
    }

    // Description
    const description = row['Verwendungszweck'] || row['Beschreibung'] || '';

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
