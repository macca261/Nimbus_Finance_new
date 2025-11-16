import { parse as parseCsvSync } from 'csv-parse/sync';
import type { ParsedRow, ParseResult, DetectionCandidate } from '../parser/types';
import { tryDecodeBuffer, normalizeHeader } from '../parser/utils';

export class PayPalParseError extends Error {
  details?: string;

  constructor(message: string, details?: string) {
    super(message);
    this.name = 'PayPalParseError';
    this.details = details;
  }
}

// German PayPal export headers
const REQUIRED_HEADER_TOKENS_DE = [
  'datum',
  'uhrzeit',
  'zeitzone',
  'name',
  'typ',
  'status',
  'währung',
  'brutto',
  'gebühr',
  'netto',
  'transaktionscode',
  'auswirkungaufguthaben',
];

// English PayPal export headers (flexible matching - some may have spaces)
const REQUIRED_HEADER_TOKENS_EN = [
  'date',
  'time',
  'timezone', // "Time zone" normalizes to "timezone"
  'name',
  'type',
  'status',
  'currency',
  'gross',
  'fee',
  'net',
  'transactionid', // "Transaction ID" normalizes to "transactionid"
  'balance',
];

const ASCII_HEADER_TOKENS_DE = REQUIRED_HEADER_TOKENS_DE.map(token =>
  token.normalize('NFKD').replace(/[\u0300-\u036f]/g, ''),
);

const ASCII_HEADER_TOKENS_EN = REQUIRED_HEADER_TOKENS_EN.map(token =>
  token.normalize('NFKD').replace(/[\u0300-\u036f]/g, ''),
);

function fixMisencodedUmlauts(value: string): string {
  return value
    .replace(/ã¤/g, 'ä')
    .replace(/ã¼/g, 'ü')
    .replace(/ã¶/g, 'ö')
    .replace(/ãŸ/g, 'ß')
    .replace(/ã/g, 'ß')
    .replace(/ã„/g, 'ä')
    .replace(/ãœ/g, 'ü')
    .replace(/ã–/g, 'ö')
    .replace(/Ã¤/g, 'ä')
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã¶/g, 'ö')
    .replace(/ÃŸ/g, 'ß');
}

const SKIP_STATUSES = new Set([
  '',
  'ausstehend',
  'pending',
  'offen',
  'storniert',
  'storno',
  'cancelled',
  'canceled',
  'entfernt',
  'zurückgerufen',
  'zurueckgerufen',
  'abgelehnt',
]);

function normalizeHeaderLine(line: string): string {
  return fixMisencodedUmlauts(
    line
    .replace(/\uFEFF/g, '')
    .replace(/"/g, '')
    .replace(/\s+/g, '')
      .toLowerCase(),
  );
}

function normalizeKey(key: string): string {
  return normalizeHeader(String(key));
}

export function isPayPalCsvText(input: Buffer | string): boolean {
  const text = Buffer.isBuffer(input) ? tryDecodeBuffer(input).text : input;
  const lines = text.split(/\r\n|\r|\n/).filter(l => l.trim().length > 0);

  if (!lines.length) return false;

  const maxScan = Math.min(lines.length, 30);

  for (let i = 0; i < maxScan; i += 1) {
    const norm = normalizeHeaderLine(lines[i]);
    const asciiNorm = norm.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    
    // Check for German PayPal headers
    const hasGermanKeyFields = norm.includes('datum') && norm.includes('status') && norm.includes('transaktionscode');
    if (hasGermanKeyFields) {
      const allPresentDE = REQUIRED_HEADER_TOKENS_DE.every((token, idx) => {
        const asciiToken = ASCII_HEADER_TOKENS_DE[idx];
        return norm.includes(token) || asciiNorm.includes(asciiToken);
      });
      if (allPresentDE) return true;
    }
    
    // Check for English PayPal headers (more flexible - require key fields + most others)
    const hasEnglishKeyFields = (norm.includes('date') || asciiNorm.includes('date')) && 
                                 (norm.includes('status') || asciiNorm.includes('status')) && 
                                 (norm.includes('transactionid') || asciiNorm.includes('transactionid'));
    if (hasEnglishKeyFields) {
      // Count how many required tokens are present (allow some flexibility)
      const presentCount = REQUIRED_HEADER_TOKENS_EN.filter((token, idx) => {
        const asciiToken = ASCII_HEADER_TOKENS_EN[idx];
        return norm.includes(token) || asciiNorm.includes(asciiToken) ||
               norm.includes(token.replace('id', ' id')) || // "Transaction ID" -> "transaction id"
               norm.includes(token.replace('zone', ' zone')); // "timezone" -> "time zone"
      }).length;
      // Require at least 10 out of 12 tokens (allowing for minor variations)
      if (presentCount >= 10) return true;
    }
  }

  return false;
}

function getField(record: Record<string, string>, candidates: string[]): string {
  const entries = Object.entries(record);
  for (const candidate of candidates) {
    const target = normalizeKey(candidate);
    const match = entries.find(([k]) => normalizeKey(k) === target);
    if (match) {
      const value = match[1] ?? '';
      return value.replace(/^"+|"+$/g, '');
    }
  }
  return '';
}

function parsePayPalRecords(text: string): Record<string, string>[] {
  const normalized = text.replace(/\uFEFF/g, '');
  const base = {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
    trim: true,
  } as const;

  const attemptParse = (input: string, delimiter: ',' | ';') =>
    parseCsvSync(input, { ...base, delimiter }) as Record<string, string>[];

  const buildSanitized = (delimiter: ',' | ';') =>
    normalized
      .replace(/\r\n|\r/g, '\n')
      .split('\n')
      .map(line => {
        const cleanedLine = fixMisencodedUmlauts(line).replace(/^\uFEFF|^ï»¿/, '');
        const trimmed = cleanedLine.trim();
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
          const inner = trimmed.slice(1, -1);
          const placeholder = '\u0001';
          const separatorPattern = delimiter === ',' ? /","/g : /";"/g;
          let working = inner;
          if (!working.startsWith('""')) {
            const sepToken = delimiter === ',' ? ',"' : ';"';
            const idx = working.indexOf(sepToken);
            if (idx > -1) {
              const first = working.slice(0, idx);
              const rest = working.slice(idx);
              working = `""${first}""${rest}`;
            }
          }
          const replaced = working.replace(separatorPattern, placeholder);
          const unescaped = replaced.replace(/""/g, '"');
          const parts = unescaped.split(placeholder).map(part => (part === '"' ? '""' : part));
          return parts.join(delimiter);
        }
        return cleanedLine;
      })
      .join('\n');

  const tryParse = (delimiter: ',' | ';') => {
    try {
      const primary = attemptParse(normalized, delimiter);
      if (primary.length) {
        const headerKeys = Object.keys(primary[0]).map(k => normalizeKey(k));
        // Check for German headers
        const hasDatumDE = headerKeys.some(k => k.includes('datum'));
        const hasTxDE = headerKeys.some(k => k.includes('transaktionscode'));
        // Check for English headers
        const hasDateEN = headerKeys.some(k => k.includes('date'));
        const hasTxEN = headerKeys.some(k => k.includes('transactionid') || k.includes('transaction id'));
        
        const isGerman = hasDatumDE && hasTxDE && headerKeys.length >= 10; // At least 10 columns for German
        const isEnglish = hasDateEN && hasTxEN && headerKeys.length >= 10; // At least 10 columns for English
        
        if (isGerman || isEnglish) {
          return primary;
        }
      }
    } catch {
      // fall back to sanitized variant below
    }

    try {
      const sanitizedInput = buildSanitized(delimiter);
      if (!sanitizedInput.trim()) return null;
      const fallback = attemptParse(sanitizedInput, delimiter);
      if (!fallback.length) return null;

      const headerKeys = Object.keys(fallback[0]).map(k => normalizeKey(k));
      // Check for German headers
      const hasDatumDE = headerKeys.some(k => k.includes('datum'));
      const hasTxDE = headerKeys.some(k => k.includes('transaktionscode'));
      // Check for English headers
      const hasDateEN = headerKeys.some(k => k.includes('date'));
      const hasTxEN = headerKeys.some(k => k.includes('transactionid') || k.includes('transaction id'));
      
      if (!((hasDatumDE && hasTxDE) || (hasDateEN && hasTxEN))) return null;

      return fallback;
    } catch {
      return null;
    }
  };

  try {
    const comma = tryParse(',');
    if (comma) return comma;
  } catch {
    // ignore, fall back to semicolon
  }

  try {
    const semi = tryParse(';');
    if (semi) return semi;
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new PayPalParseError('PayPal CSV konnte nicht geparst werden.', details);
  }

  throw new PayPalParseError(
    'PayPal CSV konnte nicht geparst werden.',
    'Keine Datenzeilen im PayPal-Export erkannt.',
  );
}

function toIsoDate(input: string | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const german = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (german) {
    const [, dd, mm, yyyy] = german;
    return `${yyyy}-${mm}-${dd}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function parseMoneyToCents(value?: string): number {
  if (!value) return 0;

  let v = value.replace(/["'\s\u00A0]/g, '');
  if (!v) return 0;

  const negative = v.startsWith('-') || /\(.*\)/.test(v);
  v = v.replace(/[()]/g, '');
  v = v.replace(/[^0-9,.-]/g, '');

  const lastComma = v.lastIndexOf(',');
  const lastDot = v.lastIndexOf('.');
  if (lastComma > lastDot) {
    v = v.replace(/\./g, '').replace(',', '.');
  }

  const num = Number.parseFloat(v);
  if (!Number.isFinite(num) || num === 0) return 0;

  const cents = Math.round(num * 100);
  return negative ? -Math.abs(cents) : Math.abs(cents);
}

function cleanId(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function mapPayPalRecord(record: Record<string, string>, index: number): ParsedRow | null {
  const rawStatus = getField(record, ['Status', 'Status der Zahlung']);
  const status = rawStatus.trim().toLowerCase();

  if (SKIP_STATUSES.has(status)) return null;

  const impactRaw = getField(record, ['Auswirkung auf Guthaben', 'Balance Impact']).trim().toLowerCase();
  if (
    (impactRaw.includes('kein') && impactRaw.includes('auswirkung')) ||
    (impactRaw.includes('no') && impactRaw.includes('impact'))
  ) {
    // true "no impact" rows
    return null;
  }

  const dateRaw = getField(record, ['Datum', 'Date', 'Datum und Uhrzeit']).trim();
  const bookingDate = toIsoDate(dateRaw);
  if (!bookingDate) return null;

  const currency = (getField(record, ['Währung', 'Currency']) || 'EUR').toUpperCase();

  const netStr = getField(record, ['Netto', 'Net']);
  const grossStr = getField(record, ['Brutto', 'Gross']);
  const feeStr = getField(record, ['Gebühr', 'Fee']);
  let amountCents = parseMoneyToCents(netStr);
  if (amountCents === 0) {
    const gross = parseMoneyToCents(grossStr);
    const fee = parseMoneyToCents(feeStr);
    if (gross !== 0 || fee !== 0) {
      amountCents = gross - fee;
    }
  }
  if (amountCents === 0) return null;

  const externalId =
    cleanId(getField(record, ['Transaktionscode', 'Transaktionscode ', 'Transaktions-ID', 'Transaction ID', 'TransactionID'])) ||
    undefined;
  if (!externalId) return null;

  const relatedExternalId =
    cleanId(
      getField(record, [
        'Zugehöriger Transaktionscode',
        'Referenztransaktionscode',
        'Reference Txn ID',
      ]),
    ) || undefined;

  const type = getField(record, ['Typ', 'Art', 'Type']).trim();
  const name = getField(record, ['Name']).trim();
  const subject = getField(record, ['Betreff', 'Subject']).trim();
  const note = getField(record, ['Hinweis', 'Note']).trim();

  const descriptionParts = [type, name, subject, note].filter(Boolean);
  const rawText = descriptionParts.join(' ') || 'PayPal';

  const direction: ParsedRow['direction'] = amountCents >= 0 ? 'in' : 'out';

  const raw: Record<string, unknown> = { __source: 'csv_paypal', __index: index };
  for (const [k, v] of Object.entries(record)) {
    const value = typeof v === 'string' ? v : String(v ?? '');
    raw[k] = value.replace(/^"+|"+$/g, '');
  }

  raw.externalId = externalId;
  if (relatedExternalId) raw.relatedExternalId = relatedExternalId;
  raw.rawStatus = rawStatus;
  raw.rawType = type;

  if (/uber\b/i.test(name) || /uber\b/i.test(rawText)) {
    raw.categoryHint = 'mobilität.taxi_ridehail';
  }

  return {
    bookingDate,
    valutaDate: bookingDate,
    amountCents,
    currency,
    direction,
    accountIban: null,
    accountId: 'paypal:wallet',
    counterparty: name || null,
    counterpartyIban: null,
    mcc: null,
    reference: relatedExternalId || null,
    externalId,
    rawText,
    raw,
  };
}

export function parsePayPalCsv(fileBuffer: Buffer): ParseResult {
  const { text } = tryDecodeBuffer(fileBuffer);

  if (!isPayPalCsvText(text)) {
    throw new PayPalParseError(
      'PayPal CSV konnte nicht geparst werden.',
      'Header nicht als offizieller PayPal-Export erkannt.',
    );
  }

  const records = parsePayPalRecords(text);
  const rows: ParsedRow[] = [];

  records.forEach((record, index) => {
    const mapped = mapPayPalRecord(record, index);
    if (mapped) rows.push(mapped);
  });

  if (!rows.length) {
    throw new PayPalParseError(
      'PayPal CSV konnte nicht geparst werden.',
      'Keine gültigen PayPal-Umsätze erkannt.',
    );
  }

  const candidates: DetectionCandidate[] = [{ profileId: 'paypal', confidence: 1 }];

  // Best-effort balances from Guthaben column, if present
  let openingBalance: number | undefined;
  let closingBalance: number | undefined;
  const balances = records
    .map(r => {
      const rawBalance = getField(r, ['Guthaben', 'Balance']).trim();
      if (!rawBalance) return null;
      return parseMoneyToCents(rawBalance);
    })
    .filter((v): v is number => v !== null && Number.isFinite(v));

  if (balances.length) {
    closingBalance = balances[balances.length - 1];
    if (balances.length > 1) {
      openingBalance = balances[0];
    }
  }

  return {
    profileId: 'paypal',
    confidence: 1,
    rows,
    warnings: [],
    candidates,
    openingBalance,
    closingBalance,
  };
}

