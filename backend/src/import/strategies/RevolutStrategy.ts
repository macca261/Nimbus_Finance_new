/**
 * Revolut CSV Import Strategy
 * 
 * Revolut uses English formats (comma delimiter, US number format)
 */

import { ImportStrategy, NormalizedTransaction } from '../interfaces';
import { parseGermanDate, parseGermanNumber, generateHashId } from '../utils';

export class RevolutStrategy implements ImportStrategy {
  name = 'Revolut';
  priority = 100;
  
  csvOptions = {
    separator: ',',
    encoding: 'utf-8' as const,
    skipLines: 0,
  };

  canParse(headers: string[]): boolean {
    const headerStr = headers.join(' ').toUpperCase();
    return (
      headerStr.includes('COMPLETED DATE') &&
      (headerStr.includes('PAID OUT (EUR)') || headerStr.includes('PAID IN (EUR)'))
    );
  }

  mapRow(row: Record<string, string>): NormalizedTransaction | null {
    // Revolut uses "Completed Date" in format "Mon DD, YYYY"
    const dateField = row['Completed Date'] || row['Started Date'] || '';
    const date = parseGermanDate(dateField);
    if (!date) return null;

    // Amount can be in "Paid Out (EUR)" (negative) or "Paid In (EUR)" (positive)
    const paidOut = row['Paid Out (EUR)'] || '0';
    const paidIn = row['Paid In (EUR)'] || '0';
    
    let amountCents = 0;
    if (paidOut && paidOut !== '0') {
      amountCents = -Math.abs(parseGermanNumber(paidOut));
    } else if (paidIn && paidIn !== '0') {
      amountCents = Math.abs(parseGermanNumber(paidIn));
    }
    
    if (amountCents === 0) return null;

    const payee = row['Merchant'] || row['Counterparty'] || 'Unknown';
    const description = row['Description'] || row['Reference'] || '';

    const currency = row['Currency'] || 'EUR';

    const hashId = generateHashId(date, amountCents, payee, description);

    return {
      date,
      amountCents,
      payee: payee.trim(),
      description: description.trim(),
      currency,
      externalId: row['Transaction ID'] || null,
      hashId,
    };
  }
}

