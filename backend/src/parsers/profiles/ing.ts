import { BankProfile } from '../types';

export const ingProfile: BankProfile = {
  id: 'ing',
  displayName: 'ING',
  headerHints: ['buchung', 'wertstellung', 'verwendungszweck', 'betrag'],
  columnMap(headers) {
    const lc = headers.map((h) => h.toLowerCase());
    const find = (alts: string[]) => {
      const idx = lc.findIndex((h) => alts.some((a) => h.includes(a)));
      return idx >= 0 ? headers[idx] : undefined;
    };
    return {
      bookedAt: find(['buchungsdatum', 'buchung']),
      valueDate: find(['wertstellung']),
      amount: find(['betrag']),
      currency: undefined,
      purpose: find(['verwendungszweck', 'text']),
      counterpart: find(['auftraggeber', 'begünstigter', 'zahlungspflichtiger']),
      iban: find(['iban']),
      bic: find(['bic']),
      balanceAfter: undefined,
    };
  },
};

