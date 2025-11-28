import type { CanonicalTransaction } from '@nimbus/shared/src/types/canonical';
import type { BankParser, ParserContext } from '../parserTypes';
import { cleanText, parseAmount, parseIsoDate } from '../helpers';

export class PayPalParser implements BankParser {
  canHandle(signature: { family: string }): boolean {
    return signature.family === 'PayPal';
  }

  parse(ctx: ParserContext): CanonicalTransaction[] {
    const rows: CanonicalTransaction[] = [];
    const headerMap = mapHeader(ctx.header);

    for (const row of ctx.rows) {
      const status = cleanText(row[headerMap.status]);
      if (status.toLowerCase() !== 'completed') continue;

      try {
        const date = parseIsoDate(row[headerMap.date]);
        const amountCents = parseAmount(row[headerMap.gross], 'dotDecimal');
        const currency = cleanText(row[headerMap.currency]) || 'EUR';

        rows.push({
          id: '',
          bookingDate: date,
          valueDate: date,
          amount: amountCents / 100,
          currency,
          counterpartName: cleanText(row[headerMap.name]) || undefined,
          purpose: [row[headerMap.type], row[headerMap.name]].map(cleanText).filter(Boolean).join(' '),
        });
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
    map.set(h.trim().toLowerCase(), idx);
  });
  return {
    date: map.get('date') ?? 0,
    status: map.get('status') ?? 1,
    gross: map.get('gross') ?? map.get('amount') ?? 2,
    currency: map.get('currency') ?? 3,
    name: map.get('name') ?? 4,
    type: map.get('type') ?? 5,
  };
}


