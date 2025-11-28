import type { CanonicalTransaction } from '@nimbus/shared/src/types/canonical';
import type { BankParser, ParserContext } from '../parserTypes';
import { cleanText, parseGermanDate, parseAmount } from '../helpers';

const POSSIBLE_COLUMNS = {
  bookingDate: [/buchungstag/, /buchungsdatum/],
  valueDate: [/valutadatum/, /wertstellung/],
  amount: [/betrag/, /umsatz.*eur/],
  currency: [/waehrung/, /währung/],
  bookingText: [/buchungstext/, /umsatzart/],
  purpose: [/verwendungszweck/],
  counterparty: [/beg[uü]nstigter\/zahlungspflichtiger/, /auftraggeber|empfaenger/],
  counterpartyIban: [/iban/, /kontonummer/],
  debitCredit: [/soll\/haben|s\/h/],
};

function mapColumns(header: string[]) {
  const map = new Map<string, number>();
  header.forEach((h, index) => {
    const normalized = h;
    for (const [key, patterns] of Object.entries(POSSIBLE_COLUMNS)) {
      if (patterns.some(pattern => pattern.test(normalized))) {
        map.set(key, index);
      }
    }
  });
  return map;
}

function normalizeHeaderCell(value: string) {
  return value
    .replace(/\uFEFF/g, '')
    .replace(/^"+|"+$/g, '')
    .trim()
    .toLowerCase();
}

export class LegacyGermanParser implements BankParser {
  canHandle(signature: { family: string }): boolean {
    return signature.family === 'GermanLegacy';
  }

  parse(ctx: ParserContext): CanonicalTransaction[] {
    const headerNorm = ctx.header.map(normalizeHeaderCell);
    const headerMap = mapColumns(headerNorm);
    const rows: CanonicalTransaction[] = [];

    const bookingDateIndex = headerNorm.findIndex(h => h.includes('buchungstag'));
    const valueDateIndex = headerNorm.findIndex(h => h.includes('wertstellung') || h.includes('valuta'));
    const amountIndex = headerNorm.findIndex(h =>
      h.includes('umsatz in eur') || h.includes('betrag') || h.includes('umsatz'),
    );
    const textIndex = headerNorm.findIndex(h => h.includes('buchungstext') || h.includes('verwendungszweck'));

    for (const row of ctx.rows) {
      if (bookingDateIndex === -1 || amountIndex === -1) continue;

      try {
        const bookingDate = parseGermanDate(row[bookingDateIndex]);
        const rawValueDate = valueDateIndex !== -1 ? row[valueDateIndex] : null;
        const valueDate = rawValueDate ? parseGermanDate(rawValueDate) : bookingDate;
        const format = ctx.signature.numberFormat || 'commaDecimal';
        const amountCents = parseAmount(row[amountIndex], format);

        let signedAmount = amountCents;
        const debitCreditIndex = headerMap.get('debitCredit');
        if (debitCreditIndex != null) {
          const indicator = cleanText(row[debitCreditIndex]).toLowerCase();
          if (indicator.startsWith('s') || indicator.startsWith('debit')) signedAmount *= -1;
        }

        const currencyIndex = headerMap.get('currency');
        const currency = currencyIndex != null ? cleanText(row[currencyIndex]) || 'EUR' : 'EUR';

        const bookingTextIndex = headerMap.get('bookingText') ?? textIndex;
        const purposeIndex = headerMap.get('purpose');
        const bookingText = bookingTextIndex != null ? cleanText(row[bookingTextIndex]) : '';
        const purpose = purposeIndex != null ? cleanText(row[purposeIndex]) : '';

        const counterpartyIndex = headerMap.get('counterparty');
        const counterpartName = counterpartyIndex != null ? cleanText(row[counterpartyIndex]) : undefined;
        const ibanIndex = headerMap.get('counterpartyIban');
        const counterpartIban = ibanIndex != null ? cleanText(row[ibanIndex]) || undefined : undefined;

        rows.push({
          id: '',
          bookingDate,
          valueDate,
          amount: signedAmount / 100,
          currency,
          purpose: [bookingText, purpose].filter(Boolean).join(' ').trim() || undefined,
          counterpartName,
          counterpartIban,
        });
      } catch {
        // skip bad rows
      }
    }

    return rows;
  }
}


