import { parse as parseCsvSync } from 'csv-parse/sync';
import type { ParsedRow, ParseResult, DetectionCandidate } from './types';
import { tryDecodeBuffer, normalizeHeader } from '../parser/utils';

export class PayPalParseError extends Error {
  details?: string;

  constructor(message: string, details?: string) {
    super(message);
    this.name = 'PayPalParseError';
    this.details = details;
  }
}

const REQUIRED_HEADER_TOKENS = [
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
  'abgelehnt',
]);

function normalizeHeaderLine(line: string): string {
  return line
    .replace(/\uFEFF/g, '')
    .replace(/"/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

export function isPayPalCsvText(input: Buffer | string): boolean {
  const text = Buffer.isBuffer(input) ? tryDecodeBuffer(input).text : input;
  const lines = text.split(/\r\n|\r|\n/).filter(l => l.trim().length > 0);
  if (!lines.length) return false;

  const maxScan = Math.min(lines.length, 30);

  for (let i = 0; i < maxScan; i += 1) {
    const norm = normalizeHeaderLine(lines[i]);
    if (
      !norm.includes('datum') ||
      !norm.includes('status') ||
      !norm.includes('transaktionscode')
    ) {
      continue;
    }

    const allPresent = REQUIRED_HEADER_TOKENS.every(token => norm.includes(token));
    if (allPresent) return true;
  }

  return false;
}

function sanitizePayPalText(text: string): string {
  return text
    .replace(/\uFEFF/g, '')
    .split(/\r\n|\r|\n/)
    .map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        const inner = trimmed.slice(1, -1);
        return inner.replace(/""/g, '"');
      }
      return line;
    })
    .join('\n');
}

function hasPayPalColumns(records: Record<string, string>[]): boolean {
  if (!records.length) return false;
  const headers = Object.keys(records[0] ?? {}).map(normalizeKey);
  const hasDatum = headers.some(key => key.includes('datum'));
  const hasTransaction = headers.some(key => key.includes('transaktionscode'));
  return hasDatum && hasTransaction;
}

function parsePayPalRecords(text: string): Record<string, string>[] {
  const baseConfig = {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
    trim: true,
  } as const;

  const normalized = sanitizePayPalText(text).replace(/\uFEFF/g, '').replace(/\r\n|\r/g, '\n');
  const delimiters: Array<',' | ';'> = [',', ';'];
  let lastError: unknown;
  let parsedButInvalid = false;

  for (const delimiter of delimiters) {
    try {
      const records = parseCsvSync(normalized, { ...baseConfig, delimiter }) as Record<string, string>[];
      if (records.length === 0) {
        continue;
      }
      if (hasPayPalColumns(records)) {
        return records;
      }
      parsedButInvalid = true;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    const details = lastError instanceof Error ? lastError.message : String(lastError);
    throw new PayPalParseError('PayPal CSV konnte nicht geparst werden.', details);
  }

  if (parsedButInvalid) {
    throw new PayPalParseError(
      'PayPal CSV konnte nicht geparst werden.',
      'Keine Datenzeilen im PayPal-Export erkannt.',
    );
  }

  throw new PayPalParseError(
    'PayPal CSV konnte nicht geparst werden.',
    'Keine Datenzeilen im PayPal-Export erkannt.',
  );
}

function toIsoDate(input?: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const m = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
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

function normalizeKey(key: string): string {
  return normalizeHeader(String(key));
}

function getField(record: Record<string, string>, candidates: string[]): string {
  const entries = Object.entries(record);
  for (const candidate of candidates) {
    const target = normalizeKey(candidate);
    const match = entries.find(([rawKey]) => normalizeKey(rawKey) === target);
    if (match) return match[1] ?? '';
  }
  return '';
}

function derivePayPalCategoryHint(type: string, name: string, subject: string): string | undefined {
  const parts = [type, name, subject].map(value => value.toLowerCase());
  if (parts.some(value => value.includes('uber'))) {
    return 'mobilität.taxi_ridehail';
  }

  if (parts.some(value => value.includes('spotify') || value.includes('netflix') || value.includes('subscription') || value.includes('abo'))) {
    return 'abos_und_digitales.allgemein';
  }

  if (parts.some(value => value.includes('ebay') || value.includes('amazon'))) {
    return 'shopping.online';
  }

  return undefined;
}

function mapPayPalRecord(record: Record<string, string>, index: number): ParsedRow | null {
  const rawStatus = getField(record, ['Status', 'Status der Zahlung']).trim();
  const status = rawStatus.toLowerCase();
  if (SKIP_STATUSES.has(status)) return null;

  const impactRaw = getField(record, ['Auswirkung auf Guthaben', 'Balance Impact']).trim().toLowerCase();
  const impactNorm = impactRaw.replace(/\s+/g, '');

  const noImpact =
    (impactRaw.includes('kein') && impactRaw.includes('auswirkung')) ||
    (impactRaw.includes('no') && impactRaw.includes('impact'));
  if (noImpact) {
    return null;
  }

  const dateRaw =
    getField(record, ['Datum']) ||
    getField(record, ['Datum und Uhrzeit']) ||
    getField(record, ['Date']);
  const bookingDate = toIsoDate(dateRaw);
  if (!bookingDate) return null;

  const currency = (getField(record, ['Währung', 'Currency']) || 'EUR').toUpperCase();

  let amountCents = parseMoneyToCents(getField(record, ['Netto', 'Net']));
  if (amountCents === 0) {
    const gross = parseMoneyToCents(getField(record, ['Brutto', 'Gross']));
    const fee = parseMoneyToCents(getField(record, ['Gebühr', 'Fee']));
    if (gross !== 0 || fee !== 0) {
      amountCents = gross - fee;
    }
  }
  if (amountCents === 0) return null;

  const externalId =
    cleanId(getField(record, ['Transaktionscode'])) ||
    cleanId(getField(record, ['Transaktions-ID'])) ||
    cleanId(getField(record, ['Transaction ID'])) ||
    undefined;
  if (!externalId) return null;

  const relatedExternalId =
    cleanId(getField(record, ['Zugehöriger Transaktionscode'])) ||
    cleanId(getField(record, ['Reference Txn ID'])) ||
    cleanId(getField(record, ['Referenztransaktionscode'])) ||
    undefined;

  const type = getField(record, ['Typ', 'Art', 'Type']).trim();
  const name = getField(record, ['Name']).trim();
  const subject = getField(record, ['Betreff', 'Subject']).trim();
  const note = getField(record, ['Hinweis', 'Note']).trim();

  // Extra safety: skip generic authorizations without real impact when impactNorm is empty but type looks like auth
  const typeNorm = type.toLowerCase();
  if (!impactNorm && typeNorm.includes('allgemeine autorisierung')) {
    return null;
  }

  const descriptionParts = [type, name, subject, note].filter(Boolean);
  const rawText = descriptionParts.join(' ') || 'PayPal';

  let direction: ParsedRow['direction'] = amountCents >= 0 ? 'in' : 'out';

  if (impactNorm === 'soll' && amountCents > 0) {
    amountCents = -amountCents;
    direction = 'out';
  } else if (impactNorm === 'haben' && amountCents < 0) {
    amountCents = -amountCents;
    direction = 'in';
  }

  const raw: Record<string, unknown> = {
    __source: 'csv_paypal',
    __index: index,
  };

  for (const [key, value] of Object.entries(record)) {
    raw[key] = typeof value === 'string' ? value : String(value ?? '');
  }

  raw.externalId = externalId;
  if (relatedExternalId) raw.relatedExternalId = relatedExternalId;
  raw.rawStatus = rawStatus;
  raw.rawType = type;

  const categoryHint = derivePayPalCategoryHint(type, name, subject);
  if (categoryHint) {
    raw.categoryHint = categoryHint;
  }

  const parsed: ParsedRow = {
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
    rawText,
    raw,
  };

  return parsed;
}

export function parsePayPalCsv(fileBuffer: Buffer): ParseResult {
  const { text } = tryDecodeBuffer(fileBuffer);

  if (!isPayPalCsvText(text)) {
    throw new PayPalParseError(
      'PayPal CSV konnte nicht geparst werden.',
      'Header nicht als offizieller PayPal-Export erkannt.',
    );
  }

  let records: Record<string, string>[];
  try {
    records = parsePayPalRecords(text);
  } catch (error) {
    if (error instanceof PayPalParseError) throw error;
    const details = error instanceof Error ? error.message : String(error);
    throw new PayPalParseError('PayPal CSV konnte nicht geparst werden.', details);
  }

  const rows: ParsedRow[] = [];
  let openingBalance: number | undefined;
  let closingBalance: number | undefined;

  records.forEach((record, index) => {
    const mapped = mapPayPalRecord(record, index);
    if (mapped) {
      rows.push(mapped);

      const balanceField = getField(record, ['Guthaben', 'Balance']);
      if (balanceField.trim().length > 0) {
        const balanceCents = parseMoneyToCents(balanceField);
        if (!Number.isNaN(balanceCents)) {
          if (openingBalance === undefined) {
            openingBalance = balanceCents;
          }
          closingBalance = balanceCents;
        }
      }
    }
  });

  if (!rows.length) {
    throw new PayPalParseError(
      'PayPal CSV konnte nicht geparst werden.',
      'Keine gültigen PayPal-Umsätze erkannt.',
    );
  }

  const candidates: DetectionCandidate[] = [
    { profileId: 'paypal', confidence: 1 },
  ];

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