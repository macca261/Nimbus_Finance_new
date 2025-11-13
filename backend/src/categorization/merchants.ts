export type MerchantInfo = {
  merchant: string | undefined;
  brand?: string | undefined;
};

type MerchantRule = {
  match: RegExp;
  merchant: string;
  brand?: string;
};

const MAP: MerchantRule[] = [
  { match: /\buber\b|\buber\s+bv\b/i, merchant: 'UBER', brand: 'Uber' },
  { match: /\brewe\b/i, merchant: 'REWE', brand: 'REWE' },
  { match: /\bedeka\b/i, merchant: 'EDEKA', brand: 'EDEKA' },
  { match: /\bdm-drogerie\b|\bdm\b/i, merchant: 'DM', brand: 'dm-drogerie markt' },
  { match: /\battle\s?prime\b|\bamazon\.de\b|\bamazon\b/i, merchant: 'AMAZON', brand: 'Amazon' },
  { match: /\bnetflix\b/i, merchant: 'NETFLIX', brand: 'Netflix' },
  { match: /\bspotify\b/i, merchant: 'SPOTIFY', brand: 'Spotify' },
  { match: /\bdeutsche\s?bahn\b|\bdb\b.*(reise|ticket)/i, merchant: 'DEUTSCHE_BAHN', brand: 'Deutsche Bahn' },
  { match: /\bdeutsche\s?telekom\b|\btelekom\b/i, merchant: 'TELEKOM', brand: 'Deutsche Telekom' },
  { match: /\bvodafone\b/i, merchant: 'VODAFONE', brand: 'Vodafone' },
  { match: /\bpenny\b/i, merchant: 'PENNY', brand: 'PENNY' },
  { match: /\bnetto\b/i, merchant: 'NETTO', brand: 'Netto' },
  { match: /\baldi\b/i, merchant: 'ALDI', brand: 'ALDI' },
  { match: /\blidl\b/i, merchant: 'LIDL', brand: 'Lidl' },
];

export function normalizeMerchant(rawText: string | undefined, counterparty: string | null | undefined): MerchantInfo {
  const haystack = `${counterparty ?? ''} ${rawText ?? ''}`.toLowerCase();

  for (const entry of MAP) {
    if (entry.match.test(haystack)) {
      return { merchant: entry.merchant, brand: entry.brand };
    }
  }

  const cp = (counterparty ?? '').trim();
  if (cp.length >= 3) {
    return { merchant: cp.toUpperCase() };
  }

  return { merchant: undefined };
}


