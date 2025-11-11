import type { BankId } from './types.js';

/**
 * Detects bank from CSV header row
 */
export function detectBank(row: Record<string,string>): BankId | undefined {
  const h = Object.keys(row).map(x => x.toLowerCase());
  const has = (needle: string) => h.some(x => x.includes(needle));
  if (has('buchungstag') && has('buchungstext') && has('umsatz in eur')) return 'comdirect';
  if (has('valuta') || has('saldo') || has('primanota')) return 'sparkasse';
  if (has('vorgang') || has('verwendungszweck') || has('buchungsdatum')) return 'deutsche-bank';
  return undefined;
}

