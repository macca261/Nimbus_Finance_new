import type { ParsedRow } from '../parser/types';

const NOISE_PATTERNS: RegExp[] = [
  /\bSVWZ\+[^ ]+/gi,
  /\bEREF\+[^ ]+/gi,
  /\bMREF\+[^ ]+/gi,
  /\bCRED\+[^ ]+/gi,
  /\bDE\d{2}[A-Z0-9]{18,}/gi,
];

export function normalizeText(input: string | undefined | null): string {
  if (!input) return '';
  let text = input;

  text = text.replace(/\s+/g, ' ');

  for (const pattern of NOISE_PATTERNS) {
    text = text.replace(pattern, '');
  }

  text = text.replace(/PAYPAL ?\*?/gi, ' ');

  return text.trim();
}

export function enrichRowBase(row: ParsedRow): ParsedRow {
  const rawText =
    row.rawText ||
    (typeof row.raw?.description === 'string' ? (row.raw.description as string) : '') ||
    '';

  const normalizedText = normalizeText(rawText);

  return {
    ...row,
    rawText,
    normalizedText,
  };
}


