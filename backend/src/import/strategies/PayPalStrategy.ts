/**
 * PayPal CSV Import Strategy
 * 
 * Detects PayPal CSV exports by headers:
 * - "Transaktionscode" OR "Transaction ID"
 * 
 * Format:
 * - Separator: comma (,)
 * - Encoding: UTF-8
 * - Number format: International (1,234.56) or German (1.234,56) - varies by locale
 * - Date format: DD.MM.YYYY or MM/DD/YYYY (varies by locale)
 */

import { ImportStrategy, NormalizedTransaction } from './ImportStrategy';
import { parseNumberAuto, parseGermanDate, generateSyntheticId } from '../utils';
import { cleanPayee } from '../utils/payeeCleaner';

export class PayPalStrategy implements ImportStrategy {
  name = 'PayPal';

  csvOptions = {
    separator: ',',
    skipLines: 0,
    encoding: 'utf-8' as const,
  };

  matches(headers: string): boolean {
    const upper = headers.toUpperCase();
    return (
      upper.includes('TRANSAKTIONSCODE') ||
      upper.includes('TRANSACTION ID') ||
      upper.includes('TRANSACTIONID')
    );
  }

  mapRow(row: any): NormalizedTransaction | null {
    // Required fields
    const dateStr = row['Datum'] || row['Date'] || row['Buchungsdatum'] || '';
    
    // PayPal uses "Brutto" (Gross) or "Netto" (Net)
    // If Brutto is empty, fall back to Netto
    const amountStr = row['Brutto'] || row['Gross'] || row['Netto'] || row['Net'] || '';
    
    // Skip empty rows
    if (!dateStr || !amountStr) {
      return null;
    }

    // Parse date - PayPal can use different formats
    let date: string;
    if (dateStr.includes('/')) {
      // Try MM/DD/YYYY format
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const [month, day, year] = parts;
        date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      } else {
        date = parseGermanDate(dateStr);
      }
    } else {
      date = parseGermanDate(dateStr);
    }
    
    // Parse amount - PayPal can use either format, use auto-detection
    const amountCents = parseNumberAuto(amountStr);
    
    // Skip zero amounts
    if (amountCents === 0) {
      return null;
    }

    // Payee
    const payee = row['Name'] || row['Name des Empfängers'] || row['Recipient'] || 'PayPal';

    // Description
    const description = row['Artikelbezeichnung'] || row['Typ'] || row['Type'] || row['Verwendungszweck'] || '';

    // Clean payee
    const cleanedPayee = cleanPayee(payee);

    // Use Transaction ID if available, otherwise generate synthetic
    const externalId = row['Transaktionscode'] || row['Transaction ID'] || row['TransactionID'] || 
                       generateSyntheticId(date, amountCents, cleanedPayee);

    return {
      date,
      amountCents,
      payee: cleanedPayee || 'PayPal',
      description: description.trim(),
      currency: 'EUR',
      externalId,
    };
  }
}
