import { parse as parseCsvSync } from 'csv-parse/sync';

import type { ParsedRow, ParseResult, DetectionCandidate } from '../types';
import { tryDecodeBuffer, normalizeHeader } from '../../parser/utils';

export const id = 'n26_de' as const;

type Row = Record<string, string>;

function nk(value: string): string {
  return normalizeHeader(value);
}

function get(row: Row, keys: string[]): string {
  for (const key of keys) {
    const wanted = nk(key);
    for (const [rawKey, rawValue] of Object.entries(row)) {
      if (nk(rawKey) === wanted) {
        return rawValue ?? '';
      }
    }
  }
  return '';
}

function toIsoFromN26Date(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const germanMatch = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (germanMatch) {
    return `${germanMatch[3]}-${germanMatch[2]}-${germanMatch[1]}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

function parseMoneyToCents(raw?: string): number {
  if (!raw) return 0;
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
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  const cents = Math.round(parsed * 100);
  return negative ? -Math.abs(cents) : Math.abs(cents);
}

export function detect(text: string): { hit: boolean; confidence: number } {
  const lines = text
    .split(/\r\n|\r|\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 10);

  for (const line of lines) {
    const header = line.replace(/"/g, '').replace(/\s+/g, '').toLowerCase();
    const looks =
      (header.includes('date') || header.includes('bookingdate')) &&
      (header.includes('payee') || header.includes('merchant') || header.includes('name')) &&
      (header.includes('amount') || header.includes('amount(eur)')) &&
      (header.includes('transactiontype') || header.includes('type')) &&
      (header.includes('paymentreference') || header.includes('reference') || header.includes('description'));
    if (looks) {
      return { hit: true, confidence: 1 };
    }
  }

  return { hit: false, confidence: 0 };
}

export function parse(fileBuffer: Buffer): ParseResult {
  const { text } = tryDecodeBuffer(fileBuffer);
  const detection = detect(text);

  if (!detection.hit) {
    return {
      profileId: id,
      confidence: 0,
      rows: [],
      warnings: ['Header nicht als N26-Export erkannt.'],
      candidates: [{ profileId: id, confidence: 0 }],
      openingBalance: undefined,
      closingBalance: undefined,
    };
  }

  const baseOptions = {
    columns: true,
    bom: true,
    trim: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
  } as const;

  const cleaned = text.replace(/\uFEFF/g, '');

  let records: Row[] = [];
  try {
    records = parseCsvSync(cleaned, { ...baseOptions, delimiter: ',' }) as Row[];
  } catch {
    records = parseCsvSync(cleaned, { ...baseOptions, delimiter: ';' }) as Row[];
  }

  const rows: ParsedRow[] = [];

  records.forEach((record, index) => {
    const bookingDate =
      toIsoFromN26Date(get(record, ['Date', 'Booking date'])) ??
      toIsoFromN26Date(get(record, ['Datum']));

    if (!bookingDate) {
      return;
    }

    const amountRaw = get(record, ['Amount (EUR)', 'Amount', 'Betrag']);
    const amountCents = parseMoneyToCents(amountRaw);
    if (amountCents === 0) {
      return;
    }

    const currency = (get(record, ['Currency', 'Währung']) || 'EUR').toUpperCase();
    const payee = get(record, ['Payee', 'Merchant', 'Name']).trim();
    const reference = get(record, ['Payment reference', 'Reference', 'Description', 'Verwendungszweck']).trim();
    const type = get(record, ['Transaction type', 'Type', 'Buchungstext']).trim();

    const direction: ParsedRow['direction'] = amountCents >= 0 ? 'in' : 'out';
    const rawText = [type, reference, payee].filter(Boolean).join(' ') || 'N26';

    const raw: Record<string, unknown> = { __source: 'csv_n26_de', __index: index };
    for (const [key, value] of Object.entries(record)) {
      raw[key] = value;
    }

    rows.push({
      bookingDate,
      valutaDate: bookingDate,
      amountCents,
      currency,
      direction,
      accountIban: null,
      accountId: 'n26:giro',
      counterparty: payee || null,
      counterpartyIban: null,
      mcc: null,
      reference: null,
      rawText,
      raw,
    });
  });

  const candidates: DetectionCandidate[] = [{ profileId: id, confidence: detection.confidence }];

  return {
    profileId: id,
    confidence: detection.confidence,
    rows,
    warnings: [],
    candidates,
    openingBalance: undefined,
    closingBalance: undefined,
  };
}


