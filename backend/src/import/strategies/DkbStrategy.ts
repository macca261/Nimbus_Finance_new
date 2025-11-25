/**
 * DKB (Deutsche Kreditbank) CSV Import Strategy
 */

import { ImportStrategy, NormalizedTransaction } from '../interfaces';
import { parseGermanDate, parseGermanNumber, generateHashId } from '../utils';

export class DkbStrategy implements ImportStrategy {
  name = 'DKB';
  priority = 100;
  
  csvOptions = {
    separator: ';',
    encoding: 'latin1' as const,
    skipLines: 0,
  };

  canParse(headers: string[]): boolean {
    const headerStr = headers.join(' ').toUpperCase();
    return (
      headerStr.includes('MANDATSREFERENZ') &&
      (headerStr.includes('GLÄUBIGER-ID') || headerStr.includes('GLÄUBIGER ID'))
    );
  }

  mapRow(row: Record<string, string>): NormalizedTransaction | null {
    const dateField = row['Buchungstag'] || row['Wertstellung'] || '';
    const date = parseGermanDate(dateField);
    if (!date) return null;

    const amountRaw = row['Betrag'] || '';
    const amountCents = parseGermanNumber(amountRaw);
    if (amountCents === 0 && !amountRaw) return null;

    const payee = row['Begünstigter/Zahlungspflichtiger'] || 'Unknown';
    const description = row['Verwendungszweck'] || '';

    const currency = row['Währung'] || 'EUR';

    const hashId = generateHashId(date, amountCents, payee, description);

    return {
      date,
      amountCents,
      payee: payee.trim(),
      description: description.trim(),
      currency,
      externalId: row['Mandatsreferenz'] || null,
      hashId,
    };
  }
}

