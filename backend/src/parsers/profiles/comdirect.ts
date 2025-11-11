import { BankProfile } from '../types';
import { parseFlexibleDate, parseEuroAmount } from '../utils';

export const comdirectProfile: BankProfile = {
  id: 'comdirect',
  displayName: 'Comdirect',
  headerHints: ['buchungstag', 'wertstellung', 'umsatz in eur', 'buchungstext'],
  preprocess(lines) {
    // skip preamble until we hit a header line containing Buchungstag AND Umsatz in EUR
    const idx = lines.findIndex((l) => /buchungstag/i.test(l) && /umsatz in eur/i.test(l));
    return idx > -1 ? lines.slice(idx) : lines;
  },
  columnMap(headers) {
    const lc = headers.map((h) => h.trim().toLowerCase());
    const find = (alts: string[]) => {
      const idx = lc.findIndex((h) => alts.some((a) => h.includes(a)));
      return idx >= 0 ? headers[idx] : undefined;
    };
    return {
      bookedAt: find(['buchungstag']),
      valueDate: find(['wertstellung']),
      amount: find(['umsatz in eur', 'betrag']),
      currency: undefined, // EUR implied
      purpose: find(['buchungstext', 'verwendungszweck']),
      counterpart: find(['auftraggeber', 'begünstigter', 'empfänger']),
      iban: find(['iban']),
      bic: find(['bic']),
      balanceAfter: undefined,
    };
  },
  parseRow(row) {
    return row;
  },
  sanityCheck(rows) {
    if (!rows.length) return { ok: false, reason: 'no data rows' };
    try {
      // ensure at least one amount/date parses
      const r = rows[0];
      const keys = Object.keys(r);
      const amtKey = keys.find((k) => /umsatz in eur|betrag/i.test(k));
      const dtKey = keys.find((k) => /buchungstag/i.test(k));
      if (!amtKey || !dtKey) return { ok: false, reason: 'missing critical headers' };
      parseEuroAmount(r[amtKey]);
      const iso = parseFlexibleDate(r[dtKey]);
      if (!iso) return { ok: false, reason: 'date parse failed' };
      return { ok: true };
    } catch (e: any) {
      return { ok: false, reason: String(e.message || e) };
    }
  },
  examples: ['Buchungstag;Wertstellung (Valuta);Vorgang;Buchungstext;Umsatz in EUR'],
};

