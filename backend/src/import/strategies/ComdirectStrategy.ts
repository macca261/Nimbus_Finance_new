/**
 * Comdirect CSV Import Strategy
 */

import { ImportStrategy, NormalizedTransaction } from '../interfaces';
import { parseGermanDate, parseGermanNumber, generateHashId } from '../utils';

export class ComdirectStrategy implements ImportStrategy {
  name = 'Comdirect';
  priority = 100;
  
  csvOptions = {
    separator: ';',
    encoding: 'latin1' as const,
    skipLines: 0,
  };

  canParse(headers: string[]): boolean {
    const headerStr = headers.join(' ').toUpperCase();
    return (
      headerStr.includes('BUCHUNGSTAG') &&
      headerStr.includes('BUCHUNGSTEXT') &&
      (headerStr.includes('UMSATZ IN EUR') || headerStr.includes('UMSATZ (EUR)'))
    );
  }

  mapRow(row: Record<string, string>): NormalizedTransaction | null {
    const dateField = row['Buchungstag'] || '';
    const date = parseGermanDate(dateField);
    if (!date) return null;

    const amountRaw = row['Umsatz (EUR)'] || 
                      row['Umsatz in EUR'] || 
                      row['Umsatz in EUR '] || // Sometimes has trailing space
                      '';
    const amountCents = parseGermanNumber(amountRaw);
    if (amountCents === 0 && !amountRaw) return null;

    const payee = row['Begünstigter/Zahlungspflichtiger'] || 'Unknown';
    const description = row['Buchungstext'] || '';

    const currency = 'EUR';

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

