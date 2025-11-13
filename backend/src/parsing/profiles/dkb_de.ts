import { parse as parseCsvSync } from 'csv-parse/sync';

import type { ParseResult, ParsedRow, ParseCandidate } from '../types';
import { tryDecodeBuffer, normalizeHeader, parseFlexibleDate, parseEuroAmount } from '../../parser/utils';

export const id = 'dkb_de' as const;

const REQUIRED_TOKENS = ['buchungstag', 'wertstellung', 'buchungstext', 'beguenstigter/zahlungspflichtiger'];
const AMOUNT_TOKENS = ['betrag(eur)', 'betrag (eur)', 'betrag'];
const NORMALIZED_REQUIRED = REQUIRED_TOKENS.map(token => normalizeDetectionToken(token));
const NORMALIZED_AMOUNT = AMOUNT_TOKENS.map(token => normalizeDetectionToken(token));

const HEADER_MAP = {
  bookingDate: ['buchungstag'],
  valutaDate: ['wertstellung', 'valuta'],
  counterparty: ['beguenstigter/zahlungspflichtiger', 'begünstigter/zahlungspflichtiger', 'name'],
  bookingText: ['buchungstext', 'text'],
  memo: ['verwendungszweck', 'vermerk', 'beschreibung'],
  iban: ['iban'],
  amountEur: ['betrag (eur)', 'betrag(eur)'],
  amount: ['betrag'],
  currency: ['waehrung', 'währung'],
} as const;

function normalizeDetectionLine(line: string): string {
  return line
    .replace(/\uFEFF/g, '')
    .replace(/"/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeDetectionToken(token: string): string {
  return token
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

function toNormalizedRecord(record: Record<string, string>): Map<string, string> {
  const normalized = new Map<string, string>();
  for (const [key, value] of Object.entries(record)) {
    const normKey = normalizeHeader(key);
    if (!normalized.has(normKey)) {
      normalized.set(normKey, value ?? '');
    }
  }
  return normalized;
}

function pickFirst(record: Map<string, string>, candidates: readonly string[]): string {
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeHeader(candidate);
    if (record.has(normalizedCandidate)) {
      return record.get(normalizedCandidate) ?? '';
    }
  }
  return '';
}

function parseDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return parseFlexibleDate(trimmed);
  } catch {
    return null;
  }
}

function parseAmount(raw: string): number | null {
  let value = raw.replace(/\u00A0/g, ' ').trim();
  if (!value) return null;

  if (/^\(.*\)$/.test(value)) {
    value = `-${value.slice(1, -1)}`;
  }

  try {
    const parsed = parseEuroAmount(value);
    return Math.round(parsed * 100);
  } catch {
    const commaIndex = value.lastIndexOf(',');
    if (commaIndex !== -1) {
      value = value.replace(/\./g, '').replace(',', '.');
    }
    const numeric = Number.parseFloat(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.round(numeric * 100);
  }
}

function extractReferenceId(text: string): string | null {
  if (!text) return null;
  const match = text.match(/[A-Za-z0-9]{10,}/);
  return match ? match[0] : null;
}

export function detect(text: string): { hit: boolean; confidence: number } {
  const lines = text.split(/\r\n|\r|\n/);
  let inspected = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    inspected += 1;
    const normalized = normalizeDetectionLine(trimmed);
    const requiredHits = NORMALIZED_REQUIRED.every(token => normalized.includes(token));
    const hasAmount = NORMALIZED_AMOUNT.some(token => normalized.includes(token));
    if (requiredHits && hasAmount) {
      return { hit: true, confidence: 1 };
    }
    if (inspected >= 10) break;
  }

  return { hit: false, confidence: 0 };
}

export function parse(fileBuffer: Buffer): ParseResult {
  const { text } = tryDecodeBuffer(fileBuffer);

  const tryParse = (delimiter: ';' | ','): Record<string, string>[] | null => {
    try {
      const result = parseCsvSync(text, {
        delimiter,
        columns: true,
        bom: true,
        trim: true,
        skip_empty_lines: true,
        relax_column_count: true,
        relax_quotes: true,
      }) as Record<string, string>[];
      if (!Array.isArray(result) || result.length === 0) return null;
      return result;
    } catch {
      return null;
    }
  };

  const records =
    tryParse(';') ??
    tryParse(',') ??
    [];

  const rows: ParsedRow[] = [];

  records.forEach((record, index) => {
    const normalized = toNormalizedRecord(record);
    const bookingDateRaw = pickFirst(normalized, HEADER_MAP.bookingDate);
    const bookingDate = parseDate(bookingDateRaw);
    if (!bookingDate) return;

    const valutaDateRaw = pickFirst(normalized, HEADER_MAP.valutaDate);
    const valutaDate = parseDate(valutaDateRaw) ?? undefined;

    const currencyRaw = pickFirst(normalized, HEADER_MAP.currency).trim().toUpperCase();
    const currency = currencyRaw || 'EUR';

    let amountString =
      pickFirst(normalized, HEADER_MAP.amountEur) ||
      pickFirst(normalized, HEADER_MAP.amount);
    const amountCents = parseAmount(amountString);
    if (amountCents === null || amountCents === 0) {
      return;
    }

    const counterpartyRaw = pickFirst(normalized, HEADER_MAP.counterparty).trim();
    const counterparty = counterpartyRaw.length > 0 ? counterpartyRaw : null;

    const bookingText = pickFirst(normalized, HEADER_MAP.bookingText).trim();
    const memo = pickFirst(normalized, HEADER_MAP.memo).trim();
    const rawTextParts = [bookingText, memo].filter(Boolean);
    const rawText = rawTextParts.join(' ').trim();

    const ibanRaw = pickFirst(normalized, HEADER_MAP.iban).replace(/\s+/g, '').toUpperCase();
    const accountIban = ibanRaw ? ibanRaw : null;

    const referenceId = extractReferenceId(memo);

    const row: ParsedRow = {
      bookingDate,
      valutaDate,
      amountCents,
      currency,
      direction: amountCents >= 0 ? 'in' : 'out',
      accountId: 'dkb:giro',
      accountIban,
      counterparty,
      counterpartyIban: null,
      rawText: rawText || bookingText || memo || counterparty || 'DKB Buchung',
      reference: referenceId,
      raw: {
        __source: 'csv_dkb_de',
        __line: index,
        ...record,
      },
    };

    rows.push(row);
  });

  const candidates: ParseCandidate[] = [{ profileId: id, confidence: 1 }];

  return {
    profileId: id,
    confidence: 1,
    rows,
    warnings: [],
    candidates,
  };
}


