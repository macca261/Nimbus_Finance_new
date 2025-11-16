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
  { match: /\buber\b|\buber\s*\*?\s*eats\b|\buber\s+bv\b/i, merchant: 'UBER', brand: 'Uber' },
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
  { match: /\bkaufland\b/i, merchant: 'KAUFLAND', brand: 'Kaufland' },
  { match: /\bglobus\b/i, merchant: 'GLOBUS', brand: 'Globus' },
  { match: /\bfamilia\b/i, merchant: 'FAMILA', brand: 'FAMILA' },
  { match: /\baldi\b/i, merchant: 'ALDI', brand: 'ALDI' },
  { match: /\blidl\s+sagt\s+danke\b|\blidl\b/i, merchant: 'LIDL', brand: 'Lidl' },
  { match: /\bdrillisch\b/i, merchant: 'DRILLISCH', brand: 'Drillisch' },
  { match: /\bo2\b/i, merchant: 'O2', brand: 'O2' },
  { match: /\b1\s*&\s*1\b/i, merchant: '1&1', brand: '1&1' },
  { match: /\bopenai\b/i, merchant: 'OPENAI', brand: 'OpenAI' },
];

export function normalizeMerchant(rawText: string | undefined, counterparty: string | null | undefined): MerchantInfo {
  // Combine counterparty and rawText for matching
  const haystack = `${counterparty ?? ''} ${rawText ?? ''}`.toLowerCase();

  // Check for PayPal transactions with nested merchants
  // Pattern: "PayPal ... Buchungstext: ... OpenAI Ireland Limited" or "Uber BV"
  if (haystack.includes('paypal')) {
    // Extract merchant from PayPal description - look for merchant names after PayPal boilerplate
    // Pattern: "PayPal ... Buchungstext: ... /PP.4162.PP/. OpenAI Ireland Limited" or "Uber BV"
    const paypalMerchantMatch = haystack.match(/paypal[^,]*?(?:buchungstext:|pp\.\d+\.pp\.|\/)([^,|]{3,}?)(?:,|ref\.|ihr\s+einkauf|ihr\s+ein\s+kauf)/i);
    if (paypalMerchantMatch) {
      let extracted = paypalMerchantMatch[1].trim();
      // Clean up extracted merchant (remove common prefixes/suffixes)
      extracted = extracted.replace(/^(\.|,|\/|\s)+|(\.|,|\/|\s)+$/g, '').trim();
      
      // Check if extracted merchant matches known patterns
      for (const entry of MAP) {
        if (entry.match.test(extracted)) {
          return { merchant: entry.merchant, brand: entry.brand };
        }
      }
      // If it's a known merchant name, use it
      if (/\b(openai|uber|netflix|spotify|mezi|pizza)\b/i.test(extracted)) {
        // Extract the main merchant name (first meaningful word)
        const mainMerchant = extracted.split(/\s+/).find(w => w.length > 2) || extracted;
        const upper = mainMerchant.toUpperCase().replace(/[^A-Z0-9]/g, '');
        return { merchant: upper, brand: extracted };
      }
    }
    
    // Also check for simple "Uber BV" pattern in PayPal transactions
    if (/\buber\s+bv\b/i.test(haystack)) {
      return { merchant: 'UBER', brand: 'Uber' };
    }
  }

  // Check for "Auftraggeber: ..." pattern (comdirect)
  const auftraggeberMatch = haystack.match(/auftraggeber:\s*([^,|]+)/i);
  if (auftraggeberMatch) {
    const auftraggeber = auftraggeberMatch[1].trim();
    for (const entry of MAP) {
      if (entry.match.test(auftraggeber)) {
        return { merchant: entry.merchant, brand: entry.brand };
      }
    }
  }

  // Standard pattern matching
  for (const entry of MAP) {
    if (entry.match.test(haystack)) {
      return { merchant: entry.merchant, brand: entry.brand };
    }
  }

  // Fallback: use counterparty if available and meaningful
  const cp = (counterparty ?? '').trim();
  if (cp.length >= 3) {
    // Remove common suffixes
    const cleaned = cp.replace(/\s+(gmbh|ag|limited|ltd|inc|corp|sa|s\.a\.r\.l\.|et\s+cie\s+s\.c\.a\.?)$/i, '').trim();
    if (cleaned.length >= 3) {
      return { merchant: cleaned.toUpperCase() };
    }
    return { merchant: cp.toUpperCase() };
  }

  return { merchant: undefined };
}


