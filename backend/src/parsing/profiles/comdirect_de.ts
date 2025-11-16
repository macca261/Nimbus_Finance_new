import { parse as parseCsvSync } from 'csv-parse/sync';

import type { ParsedRow, ParseResult, DetectionCandidate } from '../types';
import { tryDecodeBuffer, normalizeHeader } from '../../parser/utils';

export const id = 'comdirect_de' as const;

type Row = Record<string, string>;

function nk(value: string): string {
  return normalizeHeader(value);
}

function get(row: Row, keys: string[]): string {
  for (const key of keys) {
    const wanted = nk(key);
    for (const [rawKey, rawValue] of Object.entries(row)) {
      if (nk(rawKey) === wanted || nk(rawKey).includes(wanted)) {
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
    .slice(0, 15); // Check more lines to find header after metadata

  for (const line of lines) {
    const header = line.replace(/"/g, '').replace(/\s+/g, '').toLowerCase();
    // comdirect has: Buchungstag, Wertstellung (Valuta), Vorgang, Buchungstext, Umsatz in EUR
    const looks =
      header.includes('buchungstag') &&
      (header.includes('wertstellung') || header.includes('wertstellung(valuta)')) &&
      header.includes('vorgang') &&
      header.includes('buchungstext') &&
      (header.includes('umsatzineur') || header.includes('umsatz') || header.includes('betrag'));

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
      warnings: ['Header nicht als comdirect-Export erkannt.'],
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

  // Find the header row (contains "Buchungstag" and "Wertstellung")
  // This is necessary because comdirect CSVs often have metadata rows before the actual header
  const lines = cleaned.split(/\r\n|\r|\n/);
  let headerLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Guard against undefined/empty lines
    if (!line || typeof line !== 'string') continue;
    
    const normalized = normalizeHeader(line);
    if (normalized.includes('buchungstag') && normalized.includes('wertstellung')) {
      headerLineIndex = i;
      break;
    }
  }
  
  // If we found the header, parse from that line onwards
  // Otherwise, use the full text (fallback for CSVs without metadata)
  const textToParse = headerLineIndex >= 0 
    ? lines.slice(headerLineIndex).join('\n')
    : cleaned;

  // comdirect can use tab, ; or , delimiters (tabs are most common)
  let records: Row[] = [];
  let delimiter = '\t';
  
  // Try tab first (most common for comdirect)
  try {
    records = parseCsvSync(textToParse, { ...baseOptions, delimiter: '\t' }) as Row[];
    // Validate: check if we got reasonable column count (at least 3 columns)
    if (records.length > 0 && Object.keys(records[0]).length >= 3) {
      delimiter = '\t';
    } else {
      throw new Error('Invalid tab parsing');
    }
  } catch (err) {
    try {
      records = parseCsvSync(textToParse, { ...baseOptions, delimiter: ';' }) as Row[];
      if (records.length > 0 && Object.keys(records[0]).length >= 3) {
        delimiter = ';';
      } else {
        throw new Error('Invalid semicolon parsing');
      }
    } catch (err2) {
      try {
        records = parseCsvSync(textToParse, { ...baseOptions, delimiter: ',' }) as Row[];
        delimiter = ',';
      } catch (err3) {
        // If all delimiters fail, return empty result with warning
        console.warn('[comdirect] All delimiter attempts failed', {
          tabError: err instanceof Error ? err.message : String(err),
          semicolonError: err2 instanceof Error ? err2.message : String(err2),
          commaError: err3 instanceof Error ? err3.message : String(err3),
        });
        return {
          profileId: id,
          confidence: 0,
          rows: [],
          warnings: ['CSV konnte nicht geparst werden. Unbekanntes Format oder ungültige Zeichen.'],
          candidates: [{ profileId: id, confidence: 0 }],
          openingBalance: undefined,
          closingBalance: undefined,
        };
      }
    }
  }

  const rows: ParsedRow[] = [];

  records.forEach((record, index) => {
    // Skip metadata rows (they won't have valid dates)
    const bookingDateRaw = get(record, ['Buchungstag']);
    if (!bookingDateRaw || !bookingDateRaw.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
      return;
    }

    const bookingDate = toIsoDate(bookingDateRaw);
    const valutaDateRaw = get(record, ['Wertstellung (Valuta)', 'Wertstellung']);
    const valutaDate = toIsoDate(valutaDateRaw) ?? bookingDate;
    if (!bookingDate) return;

    const amountRaw = get(record, ['Umsatz in EUR', 'Umsatz', 'Betrag']);
    const amountCents = parseMoneyToCents(amountRaw);
    if (amountCents === 0) return;

    const currency = (get(record, ['Waehrung', 'Währung']) || 'EUR').toUpperCase();

    const counterparty =
      get(record, ['Auftraggeber/Empfänger', 'Auftraggeber / Empfänger', 'Begünstigter', 'Empfänger', 'Name'])
        .trim() || null;

    const memo = get(record, ['Verwendungszweck']).trim();
    const type = get(record, ['Vorgang']).trim();
    const buchungstext = get(record, ['Buchungstext']).trim();

    const accountIban = (get(record, ['IBAN', 'Kontonummer/IBAN']).trim() || null) || null;

    const direction: ParsedRow['direction'] = amountCents >= 0 ? 'in' : 'out';
    // Combine Vorgang, Buchungstext, and Verwendungszweck for full context
    const rawText = [type, buchungstext, memo].filter(Boolean).join(' ') || 'comdirect';

    const raw: Record<string, unknown> = { __source: 'csv_comdirect_de', __index: index };
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
      accountId: 'comdirect:giro',
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

