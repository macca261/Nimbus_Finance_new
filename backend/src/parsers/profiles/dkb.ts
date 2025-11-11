import { BankProfile } from '../types';

export const dkbProfile: BankProfile = {
  id: 'dkb',
  displayName: 'DKB',
  headerHints: ['buchungstag', 'wertstellung', 'verwendungszweck', 'betrag'],
  columnMap(headers) {
    const lc = headers.map((h) => h.toLowerCase());
    const find = (alts: string[]) => {
      const idx = lc.findIndex((h) => alts.some((a) => h.includes(a)));
      return idx >= 0 ? headers[idx] : undefined;
    };
    return {
      bookedAt: find(['buchungstag']),
      valueDate: find(['wertstellung']),
      amount: find(['betrag']),
      currency: undefined,
      purpose: find(['verwendungszweck', 'buchungstext']),
      counterpart: find(['gläubiger', 'auftraggeber', 'empfänger']),
      iban: find(['iban']),
      bic: find(['bic']),
      balanceAfter: undefined,
    };
  },
};

