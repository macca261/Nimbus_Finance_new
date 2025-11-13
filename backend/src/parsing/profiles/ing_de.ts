import { parse as parseCsvSync } from 'csv-parse/sync';

import type { ParsedRow, ParseResult, DetectionCandidate } from '../types';
import { tryDecodeBuffer, normalizeHeader } from '../../parser/utils';

export const id = 'ing_de' as const;

type Row = Record<string, string>;

const NK = (value: string): string => normalizeHeader(value);

function get(row: Row, keys: string[]): string {
  for (const key of keys) {
    const wanted = NK(key);
    for (const [rawKey, rawValue] of Object.entries(row)) {
      if (NK(rawKey) === wanted) {
        return rawValue ?? '';
      }
    }
  }
  return '';
}

function toIsoDate(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
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
  let value = raw.replace(/\s|\u00A0|"/g, '');
  const negative = value.startsWith('-') || /^\(.*\)$/.test(value);
  value = value.replace(/[()]/g, '');
  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');
  if (lastComma > lastDot) {
    value = value.replace(/\./g, '').replace(',', '.');
  }
  value = value.replace(/[^0-9.+-]/g, '');
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return 0;
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
      header.includes('buchung') &&
      header.includes('valuta') &&
      (header.includes('auftraggeber/empfänger') || header.includes('auftraggeberempfänger')) &&
      header.includes('buchungstext') &&
      header.includes('verwendungszweck') &&
      header.includes('betrag') &&
      (header.includes('währung') || header.includes('waehrung'));

    if (looks) return { hit: true, confidence: 1 };
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
      warnings: ['Header nicht als ING-Export erkannt.'],
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
    relax_quotes: true,
    relax_column_count: true,
    delimiter: ';',
  } as const;

  const cleaned = text.replace(/\uFEFF/g, '');
  const records = parseCsvSync(cleaned, baseOptions) as Row[];

  const rows: ParsedRow[] = [];

  records.forEach((record, index) => {
    const bookingDate = toIsoDate(get(record, ['Buchung', 'Buchungstag']));
    const valutaDate = toIsoDate(get(record, ['Valuta', 'Wertstellung'])) ?? bookingDate;
    if (!bookingDate) return;

    const amountCents = parseMoneyToCents(get(record, ['Betrag', 'Umsatz']));
    if (amountCents === 0) return;

    const currency = (get(record, ['Währung', 'Waehrung']) || 'EUR').toUpperCase();
    const counterparty = get(record, ['Auftraggeber/Empfänger', 'AuftraggeberEmpfänger']).trim() || null;
    const bookingText = get(record, ['Buchungstext']).trim();
    const purpose = get(record, ['Verwendungszweck']).trim();

    const direction: ParsedRow['direction'] = amountCents >= 0 ? 'in' : 'out';
    const rawText = [bookingText, purpose, counterparty ?? ''].filter(Boolean).join(' ') || 'ING';

    const raw: Record<string, unknown> = { __source: 'csv_ing_de', __index: index };
    for (const [key, value] of Object.entries(record)) {
      raw[key] = value;
    }

    rows.push({
      bookingDate,
      valutaDate: valutaDate ?? bookingDate,
      amountCents,
      currency,
      direction,
      accountIban: null,
      accountId: 'ing:giro',
      counterparty,
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

