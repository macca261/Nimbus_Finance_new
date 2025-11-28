import type { CanonicalTransaction } from '@nimbus/shared/src/types/canonical';
import type { BankParser, ParserContext } from '../parserTypes';
import { cleanText, parseIsoDate, parseAmount } from '../helpers';

export class NeobankParser implements BankParser {
  canHandle(signature: { family: string }): boolean {
    return signature.family === 'Neobank';
  }

  parse(ctx: ParserContext): CanonicalTransaction[] {
    const rows: CanonicalTransaction[] = [];

    for (const row of ctx.rows) {
      try {
        const signatureId = ctx.signature.id;
        if (signatureId.startsWith('n26')) {
          const headerMap = mapHeader(ctx.header);
          const bookingDate = parseIsoDate(row[headerMap.date]);
          const amountCents = parseAmount(row[headerMap.amount], 'dotDecimal');
          rows.push({
            id: '',
            bookingDate,
            valueDate: bookingDate,
            amount: amountCents / 100,
            currency: 'EUR',
            counterpartName: cleanText(row[headerMap.payee]) || undefined,
            purpose: [row[headerMap.transactionType], row[headerMap.paymentReference], row[headerMap.category]]
              .map(cleanText)
              .filter(Boolean)
              .join(' '),
          });
        } else if (signatureId.startsWith('revolut')) {
          const headerMap = mapHeader(ctx.header);
          const state = cleanText(row[headerMap.state]);
          if (!state || state.toLowerCase() !== 'completed') continue;
          const bookingDate = parseIsoDate(row[headerMap.completedDate]);
          const amountCents = parseAmount(row[headerMap.amount], 'dotDecimal');
          rows.push({
            id: '',
            bookingDate,
            valueDate: bookingDate,
            amount: amountCents / 100,
            currency: cleanText(row[headerMap.currency]) || 'EUR',
            counterpartName: cleanText(row[headerMap.description]) || undefined,
            purpose: cleanText(row[headerMap.description]) || undefined,
          });
        } else if (signatureId.startsWith('bunq')) {
          const headerMap = mapHeader(ctx.header);
          const bookingDate = parseIsoDate(row[headerMap.date]);
          const amountCents = parseAmount(row[headerMap.amount], 'commaDecimal');
          rows.push({
            id: '',
            bookingDate,
            valueDate: bookingDate,
            amount: amountCents / 100,
            currency: 'EUR',
            counterpartName: cleanText(row[headerMap.name]) || undefined,
            purpose: cleanText(row[headerMap.description]) || undefined,
          });
        }
      } catch {
        // skip row
      }
    }

    return rows;
  }
}

function mapHeader(header: string[]) {
  const map = new Map<string, number>();
  header.forEach((h, idx) => {
    const normalized = h.trim().toLowerCase();
    map.set(normalized, idx);
  });
  return {
    date: map.get('date') ?? 0,
    amount: map.get('amount (eur)') ?? map.get('amount') ?? 1,
    completedDate: map.get('completed date') ?? map.get('date') ?? 0,
    currency: map.get('currency') ?? 2,
    description: map.get('description') ?? map.get('payment reference') ?? 3,
    state: map.get('state') ?? 4,
    payee: map.get('payee') ?? 5,
    transactionType: map.get('transaction type') ?? 6,
    paymentReference: map.get('payment reference') ?? 7,
    category: map.get('category') ?? 8,
    name: map.get('name') ?? 5,
    descriptionBunq: map.get('description') ?? 4,
  };
}


