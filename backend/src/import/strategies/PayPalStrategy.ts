/**
 * PayPal CSV Import Strategy
 * 
 * Handles PayPal CSV exports with:
 * - Comma delimiter
 * - UTF-8 encoding
 * - US number format (1,000.50)
 * - Various date formats
 */

import { ImportStrategy, NormalizedTransaction } from '../interfaces';
import { parseGermanDate, parseGermanNumber, generateHashId } from '../utils';

export class PayPalStrategy implements ImportStrategy {
  name = 'PayPal';
  priority = 100; // High priority (specific provider)
  
  csvOptions = {
    separator: ',',
    encoding: 'utf-8' as const,
    skipLines: 0,
  };

  canParse(headers: string[]): boolean {
    const headerStr = headers.join(' ').toUpperCase();
    return (
      (headerStr.includes('TRANSACTIONSCODE') || headerStr.includes('TRANSACTION CODE')) &&
      (headerStr.includes('E-MAIL-ADRESSE') || headerStr.includes('EMAIL'))
    );
  }

  mapRow(row: Record<string, string>): NormalizedTransaction | null {
    // PayPal uses "Transaktionscode" or "Transaction Code" for ID
    const externalId = row['Transaktionscode'] || 
                       row['Transaction Code'] || 
                       row['Transaction ID'] ||
                       null;

    // Date field varies: "Datum" or "Date"
    const dateField = row['Datum'] || row['Date'] || '';
    const date = parseGermanDate(dateField);
    if (!date) return null;

    // Amount in "Netto" or "Net" field (US format: 1,000.50)
    const amountRaw = row['Netto'] || row['Net'] || row['Amount'] || '';
    const amountCents = parseGermanNumber(amountRaw);
    if (amountCents === 0 && !amountRaw) return null;

    // Payee from "Name" or "Merchant" or extracted from "Typ"
    const payee = row['Name'] || 
                  row['Merchant'] || 
                  row['Typ'] || 
                  'Unknown';

    // Description from "Typ" or "Verwendungszweck"
    const description = row['Typ'] || 
                        row['Verwendungszweck'] || 
                        row['Reference'] ||
                        '';

    // Currency (usually EUR, but check "Währung" or "Currency")
    const currency = row['Währung'] || row['Currency'] || 'EUR';

    const hashId = generateHashId(date, amountCents, payee, description);

    return {
      date,
      amountCents,
      payee: payee.trim(),
      description: description.trim(),
      currency,
      externalId,
      hashId,
    };
  }
}

