import { parse as parseCsvSync } from 'csv-parse/sync';
import { isPayPalCsvText, parsePayPalCsv } from './paypal';
import { categorizeBatch } from '../categorization';
import type { ParseResult, ParsedRow, ParseCandidate } from '../parsing/types';
import { BANK_PROFILES } from './profiles';
import type { BankProfile } from './types';
import { normalizeHeader, sniffDelimiter, tryDecodeBuffer, parseEuroAmount } from './utils';

const DEFAULT_HINTS = [
  'Prüfe Kopfzeile: enthält sie "Buchungstag" und "Betrag"?',
  'Prüfe Trennzeichen (; vs ,) und Dezimalformat (1.234,56).',
  'CSV als UTF-8 oder ISO-8859-1 (Latin-1) speichern.',
];

const MIN_CONFIDENCE = 0.55;

export class ParseBankCsvError extends Error {
  public readonly hints: string[];
  public readonly candidates: ParseCandidate[];

  constructor(message: string, options: { hints?: string[]; candidates?: ParseCandidate[] } = {}) {
    super(message);
    this.name = 'ParseBankCsvError';
    this.hints = options.hints ?? [];
    this.candidates = options.candidates ?? [];
  }
}

const METADATA_PATTERNS = [
  /umsätze\s+girokonto/i,
  /neuer\s+kontostand/i,
  /alter\s+kontostand/i,
  /kontostand\s+nach/i,
  /^\s*$/i,
];

const DATE_REGEXP = /^(?:\d{1,2}\.\d{1,2}\.\d{4}|\d{4}-\d{2}-\d{2})$/;

function isMetadataRow(row: string[]): boolean {
  const joined = row.map(cell => cell.trim()).join(' ').toLowerCase();
  return METADATA_PATTERNS.some(pattern => pattern.test(joined));
}

function isLikelyDate(value: string | undefined): boolean {
  if (!value) return false;
  return DATE_REGEXP.test(value.trim());
}

function findHeaderRow(rows: string[][], profiles: BankProfile[]): { index: number; headers: string[] } {
  let bestIndex = -1;
  let bestScore = 0;
  let fallbackIndex = -1;

  for (let i = 0; i < rows.length; i += 1) {
    const raw = rows[i].map(cell => cell.trim());
    if (raw.every(cell => cell.length === 0)) continue;
    if (isMetadataRow(raw)) continue;
    if (fallbackIndex === -1) fallbackIndex = i;

    const score = profiles.reduce((acc, profile) => Math.max(acc, profile.matches(raw, [])), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  const index = bestIndex !== -1 ? bestIndex : fallbackIndex;
  if (index === -1) {
    throw new ParseBankCsvError('Kein Tabellenkopf erkannt.', { hints: DEFAULT_HINTS });
  }
  return { index, headers: rows[index].map(cell => cell.trim()) };
}

function recordsFromRows(headerRow: string[], dataRows: string[][]): string[][] {
  const cleaned: string[][] = [];
  const dateColumnIndex = headerRow.findIndex(header => {
    const norm = normalizeHeader(header);
    return norm.includes('buchung') || norm.includes('datum') || norm.includes('date');
  });

  dataRows.forEach(row => {
    const trimmed = row.map(cell => (cell ?? '').trim());
    if (trimmed.every(cell => cell.length === 0)) return;
    if (isMetadataRow(trimmed)) return;
    if (dateColumnIndex >= 0) {
      const dateCandidate = trimmed[dateColumnIndex];
      if (!isLikelyDate(dateCandidate)) return;
    }
    cleaned.push(trimmed);
  });

  return cleaned;
}

function mapRecords(headers: string[], rows: string[][]): Record<string, string>[] {
  return rows.map(row => {
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = row[idx] ?? '';
    });
    return record;
  });
}

function extractBalances(rows: string[][]): { openingBalance?: number; closingBalance?: number } {
  let openingBalance: number | undefined;
  let closingBalance: number | undefined;

  for (const row of rows) {
    if (row.length < 2) continue;
    const label = (row[0] ?? '').trim().toLowerCase();
    if (!label) continue;
    const amountCandidate = row.slice(1).find(cell => (cell ?? '').trim().length > 0);
    if (!amountCandidate) continue;

    try {
      const amount = parseEuroAmount(amountCandidate);
      if (label.startsWith('alter kontostand') && openingBalance === undefined) {
        openingBalance = amount;
      } else if (label.startsWith('neuer kontostand') && closingBalance === undefined) {
        closingBalance = amount;
      }
    } catch {
      continue;
    }
  }

  return { openingBalance, closingBalance };
}

function detectProfile(
  headers: string[],
  sampleRows: string[][],
  hintedBank?: string,
): { profile: BankProfile; candidates: ParseCandidate[] } {
  const candidates = BANK_PROFILES.map(profile => ({
    profileId: profile.id,
    confidence: profile.matches(headers, sampleRows),
  })).sort((a, b) => b.confidence - a.confidence);

  if (hintedBank) {
    const normalizedHint = normalizeHeader(hintedBank);
    const hinted = candidates.find(candidate => normalizeHeader(candidate.profileId) === normalizedHint);
    if (hinted) {
      hinted.confidence = Math.max(hinted.confidence, 0.8);
      candidates.sort((a, b) => b.confidence - a.confidence);
    }
  }

  const best = candidates[0];
  if (!best || best.confidence < MIN_CONFIDENCE) {
    throw new ParseBankCsvError('Unsupported or undetected bank', {
      hints: DEFAULT_HINTS,
      candidates,
    });
  }

  const profile = BANK_PROFILES.find(item => item.id === best.profileId);
  if (!profile) {
    throw new ParseBankCsvError('Unsupported or undetected bank', {
      hints: DEFAULT_HINTS,
      candidates,
    });
  }

  return { profile, candidates };
}

export async function parseBankCsv(fileBuffer: Buffer, hintedBank?: string): Promise<ParseResult> {
  // 1) Decode once to handle different encodings reliably
  const { text } = tryDecodeBuffer(fileBuffer);

  // 2) Special-case: PayPal CSV (German/Intl export)
  // Detected *before* generic parsing to avoid csv-parse quote errors.
  if (isPayPalCsvText(text)) {
    return parsePayPalCsv(fileBuffer);
  }

  const allLines = text.split(/\r?\n/);
  const firstContentLine = allLines.find(line => line.trim().length > 0) ?? '';
  if (!firstContentLine) {
    throw new Error('Leere CSV-Datei');
  }

  const delimiter = sniffDelimiter(allLines);

  const parsed = parseCsvSync(text, {
    delimiter,
    skip_empty_lines: false,
    relax_column_count: true,
    bom: false,
    trim: false,
  }) as string[][];

  if (!parsed.length) {
    throw new ParseBankCsvError('Keine Datenzeilen gefunden.', { hints: DEFAULT_HINTS });
  }

  const { index: headerIndex, headers } = findHeaderRow(parsed, BANK_PROFILES);
  const dataRows = parsed.slice(headerIndex + 1);
  const cleanedRows = recordsFromRows(headers, dataRows);
  const balances = extractBalances(parsed);

  if (!cleanedRows.length) {
    throw new ParseBankCsvError('Keine gültigen Umsätze erkannt – Tabelle enthält keine Buchungszeilen.', {
      hints: DEFAULT_HINTS,
    });
  }

  const sampleRows = cleanedRows.slice(0, 5);
  const { profile, candidates } = detectProfile(headers, sampleRows, hintedBank);
  const records = mapRecords(headers, cleanedRows);

  const warnings: string[] = [];
  const rows: ParsedRow[] = [];

  records.forEach((record, idx) => {
    try {
      const mapped = profile.mapRow(record);
      if (mapped) {
        rows.push(mapped);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Zeile ${idx + headerIndex + 2}: ${message}`);
    }
  });

  if (!rows.length) {
    throw new ParseBankCsvError('Keine gültigen Umsätze erkannt – Tabelle enthält keine Buchungszeilen.', {
      hints: DEFAULT_HINTS,
      candidates,
    });
  }

  const categorizedRows = categorizeBatch(rows);

  return {
    profileId: profile.id,
    confidence: candidates[0]?.confidence ?? 0,
    rows: categorizedRows,
    warnings,
    candidates,
    openingBalance: balances.openingBalance,
    closingBalance: balances.closingBalance,
  };
}

