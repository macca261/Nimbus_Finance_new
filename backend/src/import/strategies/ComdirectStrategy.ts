/**
 * Comdirect CSV Import Strategy
 * 
 * Detects Comdirect CSV exports by headers:
 * - "Buchungstag" AND "Buchungstext"
 * 
 * Format:
 * - Separator: semicolon (;)
 * - Encoding: ISO-8859-1 (Latin-1) or Windows-1252
 * - Number format: German (1.234,56)
 * - Date format: DD.MM.YYYY
 * 
 * Special handling:
 * - "Buchungstext" contains rich data: "Auftraggeber: Lidl sagt Danke Buchungstext: ..."
 * - Extract payee from regex pattern in Buchungstext
 * - Preamble: 4 lines of account balance info before header
 */

import { ImportStrategy, NormalizedTransaction } from './ImportStrategy';
import { parseGermanNumber, parseGermanDate, generateSyntheticId } from '../utils';
import { cleanPayee } from '../utils/payeeCleaner';

export class ComdirectStrategy implements ImportStrategy {
  name = 'Comdirect';

  csvOptions = {
    separator: ';',
    skipLines: 4, // Skip 4 lines of account balance info (preamble)
    encoding: 'latin1' as const,
  };

  matches(headers: string): boolean {
    const upper = headers.toUpperCase();
    return (
      upper.includes('BUCHUNGSTAG') &&
      upper.includes('BUCHUNGSTEXT')
    );
  }

  mapRow(row: any): NormalizedTransaction | null {
    // Debug: Log row keys in dev mode (first call only)
    if (process.env.NODE_ENV !== 'production' && !(global as any).__comdirectLogged) {
      (global as any).__comdirectLogged = true;
      // eslint-disable-next-line no-console
      console.log('[ComdirectStrategy] First row keys:', Object.keys(row));
      // eslint-disable-next-line no-console
      console.log('[ComdirectStrategy] First row full sample:', row);
    }
    
    // Helper to find column value with case-insensitive and trimmed matching
    const findColumn = (possibleNames: string[]): string => {
      const rowKeys = Object.keys(row);
      for (const name of possibleNames) {
        // Exact match
        if (row[name] !== undefined && row[name] !== null && String(row[name]).trim()) {
          return String(row[name]);
        }
        // Case-insensitive match
        const foundKey = rowKeys.find(k => k.trim().replace(/^["']|["']$/g, '').toLowerCase() === name.toLowerCase());
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim()) {
          return String(row[foundKey]);
        }
      }
      return '';
    };
    
    // Required fields - try multiple possible column names
    const dateStr = findColumn([
      'Buchungstag',
      'Wertstellung (Valuta)',
      'Valutadatum',
      'Wertstellung',
    ]);
      
    const amountStr = findColumn([
      'Umsatz in EUR',
      'Betrag',
      'Umsatz',
      'Betrag (€)',
      'Amount',
      'Amount (EUR)',
    ]);
      
    const buchungstext = findColumn([
      'Buchungstext',
      'Verwendungszweck',
      'Description',
    ]);
    
    const vorgang = findColumn([
      'Vorgang',
      'Auftraggeber',
    ]);
    
    // Skip empty rows - but log why in dev mode
    if (!dateStr || !amountStr) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('[ComdirectStrategy] Row skipped - missing fields:', {
          hasDate: !!dateStr,
          hasAmount: !!amountStr,
          dateStr: dateStr?.substring(0, 20),
          amountStr: amountStr?.substring(0, 20),
          availableKeys: Object.keys(row),
        });
      }
      return null;
    }

    // Clean strings (remove quotes if present)
    const cleanDateStr = dateStr.replace(/^["']|["']$/g, '').trim();
    const cleanAmountStr = amountStr.replace(/^["']|["']$/g, '').trim();
    const cleanBuchungstext = buchungstext.replace(/^["']|["']$/g, '').trim();
    
    // Parse date
    const date = parseGermanDate(cleanDateStr);
    
    // Parse amount (German format)
    const amountCents = parseGermanNumber(cleanAmountStr);
    
    // Skip zero amounts
    if (amountCents === 0) {
      return null;
    }
    
    // Validate that we got actual data (date parsing might return fallback, so verify dateStr looks valid)
    if (!cleanDateStr || cleanDateStr.length < 6) {
      // Date string too short or empty
      return null;
    }
    
    // Extract payee from Buchungstext using regex
    // Pattern: "Auftraggeber: [Payee] Buchungstext: ..."
    let payee = vorgang || '';
    const payeeMatch = cleanBuchungstext.match(/Auftraggeber:\s*(.*?)(?:\s+Buchungstext:|$)/i);
    if (payeeMatch && payeeMatch[1]) {
      payee = payeeMatch[1].trim();
    }

    // If still no payee, try to extract from card transaction pattern
    // Pattern: "Lidl sagt Danke, Koeln-Muenger DE Karte Nr. 4871"
    if (!payee && cleanBuchungstext) {
      const cardMatch = cleanBuchungstext.match(/^([^,]+)/);
      if (cardMatch) {
        payee = cardMatch[1].trim();
      }
    }

    // Clean payee
    const cleanedPayee = cleanPayee(payee || cleanBuchungstext);

    // Description is the full Buchungstext (use cleaned version)
    const description = cleanBuchungstext;

    // Generate synthetic ID
    const externalId = generateSyntheticId(date, amountCents, cleanedPayee);

    return {
      date,
      amountCents,
      payee: cleanedPayee || 'Unbekannt',
      description: description || '',
      currency: 'EUR',
      externalId,
    };
  }
}
