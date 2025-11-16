import { parse } from 'csv-parse/sync';
import { tryDecodeBuffer } from '../parser/utils';
import type { ParsedRow } from './types';

/**
 * Parse German date format (DD.MM.YYYY) to ISO (YYYY-MM-DD).
 * Returns null if invalid.
 */
export function parseGermanDateToIso(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Parse German money format (1.234,56 or -1.234,56) to cents.
 * Returns null if invalid or zero.
 */
export function parseGermanMoneyToCents(raw: string): number | null {
  if (!raw || typeof raw !== 'string') return null;
  let value = raw.replace(/["\s\u00A0]/g, '');
  const negative = value.startsWith('-') || /^\(.*\)$/.test(value);
  value = value.replace(/[()]/g, '');
  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');
  if (lastComma > lastDot) {
    value = value.replace(/\./g, '').replace(',', '.');
  }
  value = value.replace(/[^\d.+-]/g, '');
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  const cents = Math.round(parsed * 100);
  const result = negative ? -Math.abs(cents) : Math.abs(cents);
  return result === 0 ? null : result;
}

/**
 * Determine transaction direction from amount in cents.
 */
export function directionFromAmount(amountCents: number): 'in' | 'out' {
  return amountCents >= 0 ? 'in' : 'out';
}

/**
 * Parse CSV records from buffer with automatic delimiter detection.
 * Returns records and detected delimiter.
 */
export function parseBankCsvRecords(buffer: Buffer): {
  records: Record<string, string>[];
  delimiter: ';' | ',' | '\t';
} {
  const { text } = tryDecodeBuffer(buffer);

  const parseWithDelim = (delimiter: ';' | ',' | '\t') => {
    try {
      const records = parse(text, {
        columns: true,
        skip_empty_lines: true,
        delimiter,
        relax_column_count: true,
        bom: true,
        trim: true,
      }) as Record<string, string>[];
      return records;
    } catch {
      return null;
    }
  };

  // Try semicolon first (most common for German banks)
  let records = parseWithDelim(';');
  if (records && records.length > 0 && Object.keys(records[0]).length > 1) {
    return { records, delimiter: ';' };
  }

  // Try tab
  records = parseWithDelim('\t');
  if (records && records.length > 0 && Object.keys(records[0]).length > 1) {
    return { records, delimiter: '\t' };
  }

  // Try comma
  records = parseWithDelim(',');
  if (records && records.length > 0 && Object.keys(records[0]).length > 1) {
    return { records, delimiter: ',' };
  }

  // Fallback to semicolon even if it looks wrong
  return { records: parseWithDelim(';') ?? [], delimiter: ';' };
}

