import type { BankId } from './types.js';

export function detectBank(row: Record<string, string>): BankId | undefined {
  const headers = Object.keys(row).map(h => h.toLowerCase());
  const has = (h: string) => headers.some(x => x.includes(h));

  if (has('ing-diba') || (has('ing') && has('wertstellung'))) return 'ing';
  if (has('commerzbank') || (has('buchungstag') && has('valuta'))) return 'commerzbank';
  if (has('postbank') || has('primanota') || has('kundenreferenz')) return 'postbank';
  if (has('deutsche bank') || has('vorgang/verwendungszweck') || has('verwendungszweck')) return 'deutsche-bank';

  return undefined;
}

