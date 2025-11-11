import { BankProfile } from '../types';

export const genericProfile: BankProfile = {
  id: 'generic_de',
  displayName: 'Generic (DE)',
  headerHints: ['buchung', 'betrag'],
  columnMap(headers) {
    const lc = headers.map((h) => h.toLowerCase());
    const find = (alts: string[]) => {
      const idx = lc.findIndex((h) => alts.some((a) => h.includes(a)));
      return idx >= 0 ? headers[idx] : undefined;
    };
    return {
      bookedAt: find(['buchungstag', 'datum', 'date']),
      valueDate: find(['wertstellung', 'valuta']),
      amount: find(['umsatz in eur', 'betrag', 'umsatz']),
      currency: find(['währung', 'currency']),
      purpose: find(['verwendungszweck', 'buchungstext', 'beschreibung', 'text']),
      counterpart: find(['auftraggeber', 'empfänger', 'begünstigter', 'name', 'payee']),
      iban: find(['iban']),
      bic: find(['bic']),
      balanceAfter: find(['saldo', 'kontostand']),
    };
  },
};

