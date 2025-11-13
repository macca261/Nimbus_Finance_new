import { parse as parseCsvSync } from 'csv-parse/sync';

import type { ParsedRow, ParseResult, DetectionCandidate } from '../types';
import { tryDecodeBuffer, normalizeHeader } from '../../parser/utils';

export const id = 'deutsche_bank_de' as const;

type Row = Record<string, string>;

function nk(value: string): string {
  return normalizeHeader(value);
}

function get(row: Row, keys: string[]): string {
  for (const key of keys) {
    const desired = nk(key);
    for (const [rawKey, rawValue] of Object.entries(row)) {
      if (nk(rawKey) === desired) {
        return rawValue ?? '';
      }
    }
  }
  return '';
}

function toIsoDate(german?: string): string | null {
  if (!german) return null;
  const trimmed = german.trim();
  const match = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
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
    const looksDeutsche =
      header.includes('buchungstag') &&
      (header.includes('betrag') || header.includes('umsatz') || header.includes('umsatzineur')) &&
      (header.includes('verwendungszweck') || header.includes('buchungstext')) &&
      (header.includes('auftraggeber/empfänger') ||
        header.includes('auftraggeber/empfaenger') ||
        header.includes('auftraggeberempfänger'));

    if (looksDeutsche) return { hit: true, confidence: 1 };
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
      warnings: ['Header nicht als Deutsche Bank-Export erkannt.'],
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
    records = parseCsvSync(cleaned, { ...baseOptions, delimiter: ';' }) as Row[];
  } catch {
    records = parseCsvSync(cleaned, { ...baseOptions, delimiter: ',' }) as Row[];
  }

  const rows: ParsedRow[] = [];

  records.forEach((record, index) => {
    const bookingDate = toIsoDate(get(record, ['Buchungstag']));
    const valutaDate = toIsoDate(get(record, ['Wertstellung'])) ?? bookingDate;
    if (!bookingDate) return;

    const amountRaw = get(record, ['Umsatz in EUR', 'Umsatz', 'Betrag']);
    const amountCents = parseMoneyToCents(amountRaw);
    if (amountCents === 0) return;

    const currency = (get(record, ['Waehrung', 'Währung']) || 'EUR').toUpperCase();

    const counterparty =
      get(record, ['Auftraggeber / Empfänger', 'Auftraggeber/Empfänger', 'Auftraggeber/Empfaenger', 'Name']).trim() || null;

    const memo = get(record, ['Verwendungszweck']).trim();
    const type = get(record, ['Buchungstext']).trim();

    const accountIban = (get(record, ['IBAN']).trim() || null) || null;

    const direction: ParsedRow['direction'] = amountCents >= 0 ? 'in' : 'out';
    const rawText = [type, memo].filter(Boolean).join(' ') || 'Deutsche Bank';

    const raw: Record<string, unknown> = { __source: 'csv_deutsche_bank_de', __index: index };
    for (const [key, value] of Object.entries(record)) {
      raw[key] = value;
    }

    rows.push({
      bookingDate,
      valutaDate: valutaDate ?? bookingDate,
      amountCents,
      currency,
      direction,
      accountIban,
      accountId: 'deutschebank:giro',
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


