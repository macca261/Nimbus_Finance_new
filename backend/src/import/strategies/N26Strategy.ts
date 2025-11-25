/**
 * N26 CSV Import Strategy
 * 
 * N26 uses modern formats (often already ISO dates, UTF-8)
 */

import { ImportStrategy, NormalizedTransaction } from '../interfaces';
import { parseGermanDate, parseGermanNumber, generateHashId } from '../utils';

export class N26Strategy implements ImportStrategy {
  name = 'N26';
  priority = 100;
  
  csvOptions = {
    separator: ',',
    encoding: 'utf-8' as const,
    skipLines: 0,
  };

  canParse(headers: string[]): boolean {
    const headerStr = headers.join(' ').toUpperCase();
    return (
      (headerStr.includes('MAIN CATEGORY') || headerStr.includes('PONZI')) &&
      headerStr.includes('DATE')
    ) || (
      headerStr.includes('PAYEE') &&
      headerStr.includes('AMOUNT (EUR)')
    );
  }

  mapRow(row: Record<string, string>): NormalizedTransaction | null {
    // N26 often uses ISO dates already
    const dateField = row['Date'] || '';
    const date = parseGermanDate(dateField);
    if (!date) return null;

    // Amount in "Amount (EUR)" or "Amount"
    const amountRaw = row['Amount (EUR)'] || row['Amount'] || '';
    const amountCents = parseGermanNumber(amountRaw);
    if (amountCents === 0 && !amountRaw) return null;

    const payee = row['Payee'] || row['Recipient'] || 'Unknown';
    const description = row['Reference'] || row['Note'] || '';

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

