import type { CanonicalTransaction } from '@nimbus/shared/src/types/canonical';

export interface CategorisationInput {
  tx: CanonicalTransaction;
  normalizedText: string;
  tokens: string[];
  isIncoming: boolean;
  amountAbs: number;
  isRoundedAmount: boolean;
  dayOfWeek: number;
  isWeekend: boolean;
}

const NOISE_PREFIXES = [
  /^paypal\s*\*?/i,
  /^pay\s*pal\s*\*?/i,
  /^kartenzahlung\s*/i,
  /^sepa\s+lastschrift\s*/i,
  /^sepa\s+ueberweisung\s*/i,
  /^sepa\s+überweisung\s*/i,
];

const MULTI_WHITE_SPACE = /\s+/g;

function stripNoisePrefixes(text: string): string {
  let current = text.trim();
  let replaced = true;
  while (replaced && current.length) {
    replaced = false;
    for (const prefix of NOISE_PREFIXES) {
      if (prefix.test(current)) {
        current = current.replace(prefix, '').trimStart();
        replaced = true;
      }
    }
  }
  return current.trim();
}

function normalizeText(rawParts: Array<string | undefined>): string {
  const combined = rawParts.filter(Boolean).join(' ').toLowerCase();
  if (!combined) return '';
  const withoutDiacritics = combined.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const cleaned = withoutDiacritics.replace(/[^\w+\s/-]/g, ' ');
  const collapsed = cleaned.replace(MULTI_WHITE_SPACE, ' ').trim();
  return stripNoisePrefixes(collapsed);
}

export function buildCategorisationInput(tx: CanonicalTransaction): CategorisationInput {
  const normalizedText = normalizeText([tx.counterpartName, tx.purpose, tx.rawCode]);
  const tokens = normalizedText.length
    ? normalizedText.split(MULTI_WHITE_SPACE).filter(token => token.length >= 2)
    : [];
  const amountAbs = Math.abs(tx.amount);
  const cents = Math.round(amountAbs * 100) % 100;
  const isRoundedAmount = cents === 0;

  let dayOfWeek = 0;
  if (tx.bookingDate) {
    const date = new Date(tx.bookingDate);
    if (!Number.isNaN(date.getTime())) {
      dayOfWeek = date.getDay();
    }
  }
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  return {
    tx,
    normalizedText,
    tokens,
    isIncoming: tx.amount > 0,
    amountAbs,
    isRoundedAmount,
    dayOfWeek,
    isWeekend,
  };
}


