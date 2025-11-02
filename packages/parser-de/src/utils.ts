import crypto from 'node:crypto';

export type CsvRow = Record<string, string>;

export type CanonicalRow = {
  bookingDate?: string;
  valueDate?: string;
  amountCents?: number;
  currency?: string;
  purpose?: string;
  counterpartName?: string;
  accountIban?: string;
  rawCode?: string;
};

export type ParseCtx = {
  parseDeDate: (s?: string) => string | undefined;
  parseEuroToCents: (s?: string) => number;
  normalizeWs: (s: string) => string;
};

export function normalizeWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export function parseDeDate(s?: string): string | undefined {
  if (!s) return undefined;
  const t = String(s).trim();
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return undefined;
}

export function parseEuroToCents(input?: string): number {
  if (!input) return 0;
  const s = String(input).trim().replace(/\s+/g, '').replace('€','');
  const isParen = /^\(.*\)$/.test(s);
  const negSuffix = s.endsWith('-');
  const negPrefix = s.startsWith('-');
  const neg = isParen || negSuffix || negPrefix;
  const cleaned = s.replace(/[()\-+]/g, '').replace(/\./g, '').replace(',', '.');
  const num = Number.parseFloat(cleaned);
  if (Number.isNaN(num)) return 0;
  const cents = Math.round(num * 100);
  return neg ? -cents : cents;
}

export function txFingerprint(row: CanonicalRow): string {
  const norm = (v?: string) => normalizeWs(v ?? '').toLowerCase();
  const parts = [
    row.bookingDate ?? '',
    row.valueDate ?? '',
    String(row.amountCents ?? 0),
    (row.currency ?? 'EUR').toUpperCase(),
    norm(row.purpose),
    norm(row.counterpartName),
    (row.accountIban ?? '').replace(/\s+/g, '').toUpperCase(),
  ];
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}


