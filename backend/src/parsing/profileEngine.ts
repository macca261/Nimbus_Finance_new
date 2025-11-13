import { parse as parseCsvSync } from 'csv-parse/sync';

import type { ParserProfile } from './profileTypes';
import type { ParsedRow, ParseResult } from './types';
import { normalizeHeader, tryDecodeBuffer, parseFlexibleDate } from '../parser/utils';

type CsvRecord = Record<string, string>;

const CSV_PARSE_OPTIONS = {
  columns: true,
  skip_empty_lines: true,
  trim: true,
  bom: true,
  relax_column_count: true,
  relax_quotes: true,
} as const;

const STATUS_HEADER_ALIASES = ['status', 'buchungsstatus', 'typ', 'buchungstyp'];

function toNormalizedMap(record: CsvRecord): Map<string, string> {
  const mapped = new Map<string, string>();
  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = normalizeHeader(key);
    if (!mapped.has(normalizedKey)) {
      mapped.set(normalizedKey, value ?? '');
    }
  }
  return mapped;
}

function pickFirst(normalized: Map<string, string>, aliases: string[] | undefined): string {
  if (!aliases || aliases.length === 0) return '';
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    if (normalized.has(normalizedAlias)) {
      return normalized.get(normalizedAlias) ?? '';
    }
  }
  return '';
}

function pickAll(normalized: Map<string, string>, aliases: string[] | undefined): string[] {
  if (!aliases || aliases.length === 0) return [];
  const values: string[] = [];
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    if (normalized.has(normalizedAlias)) {
      const value = normalized.get(normalizedAlias) ?? '';
      if (value !== '') values.push(value);
    }
  }
  return values;
}

function sanitizeAmountString(raw: string): { cleaned: string; sign: number } {
  let value = (raw ?? '')
    .replace(/\uFEFF/g, '')
    .replace(/\u00A0/g, '')
    .replace(/eur$/i, '')
    .replace(/€$/i, '')
    .replace(/\s+/g, '');
  if (!value) return { cleaned: '', sign: 1 };

  let sign = 1;
  if (value.startsWith('-')) {
    sign = -1;
    value = value.slice(1);
  } else if (value.endsWith('-')) {
    sign = -1;
    value = value.slice(0, -1);
  }

  if (value.startsWith('+')) value = value.slice(1);
  if (value.endsWith('+')) value = value.slice(0, -1);
  value = value.replace(/[+]/g, '');

  return { cleaned: value, sign };
}

function parseLocalizedAmount(
  raw: string | undefined,
  decimalComma: boolean,
  thousandSep: '.' | ',' | ' ' | undefined,
): number | null {
  if (!raw) return null;
  const { cleaned, sign } = sanitizeAmountString(raw);
  if (!cleaned) return null;

  let work = cleaned;

  if (thousandSep === ' ') {
    work = work.replace(/\s+/g, '');
  } else if (thousandSep === '.') {
    work = work.replace(/\.(?=\d{3}(\D|$))/g, '');
  } else if (thousandSep === ',') {
    work = work.replace(/,(?=\d{3}(\D|$))/g, '');
  } else {
    work = work.replace(/'(?!\d{2}$)/g, '');
  }

  if (decimalComma) {
    work = work.replace(/\./g, '');
    work = work.replace(/,/g, '.');
  } else {
    work = work.replace(/,(?=\d{3}(\D|$))/g, '');
  }

  if (!work) return null;
  const numeric = Number.parseFloat(work);
  if (!Number.isFinite(numeric)) return null;
  return sign * numeric;
}

function parseAmountCents(
  raw: string | undefined,
  decimalComma: boolean,
  thousandSep: '.' | ',' | ' ' | undefined,
): number {
  const value = parseLocalizedAmount(raw, decimalComma, thousandSep);
  if (value === null) return 0;
  return Math.round(value * 100);
}

function resolveAccountId(template: string | undefined, iban: string | null): string {
  const cleanedIban = (iban ?? '').trim().toLowerCase();
  const resolvePlaceholder = (placeholder: string): string => {
    const [primary, fallback = 'wallet'] = placeholder.split('|');
    if (primary === 'iban' && cleanedIban) return cleanedIban;
    if (primary === 'wallet') return 'wallet';
    if (primary === 'iban' && !cleanedIban) return fallback.toLowerCase();
    return primary.toLowerCase();
  };

  if (!template) {
    const fallback = cleanedIban || 'wallet';
    return `bank:${fallback}`;
  }

  return template
    .replace(/<([^>]+)>/g, (_, inner: string) => resolvePlaceholder(inner))
    .toLowerCase();
}

function matchesPendingWord(texts: string[], rules?: ParserProfile['rules']): boolean {
  if (!rules || !rules.pendingWords || rules.pendingWords.length === 0) return false;
  const haystack = texts.join(' ').toLowerCase();
  return rules.pendingWords.some(word => haystack.includes(word.toLowerCase()));
}

export function isProfileCsvText(input: Buffer | string, profile: ParserProfile): boolean {
  const text = typeof input === 'string' ? input : tryDecodeBuffer(input).text;
  const lines = text.split(/\r\n|\r|\n/);
  let inspected = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    inspected += 1;
    const normalizedLine = trimmed
      .replace(/\uFEFF/g, '')
      .replace(/"/g, '')
      .replace(/\s+/g, '')
      .toLowerCase();
    const hit = profile.detection.requiredHeaderTokens.every(token =>
      normalizedLine.includes(token),
    );
    if (hit) return true;
    if (inspected >= 10) break;
  }

  return false;
}

export function parseWithProfile(fileBuffer: Buffer, profile: ParserProfile): ParseResult {
  const { text } = tryDecodeBuffer(fileBuffer);
  const records = parseCsvSync(text, {
    ...CSV_PARSE_OPTIONS,
    delimiter: profile.detection.delimiter,
  }) as CsvRecord[];

  const rows: ParsedRow[] = [];
  const balances: number[] = [];

  records.forEach((record, index) => {
    const normalized = toNormalizedMap(record);

    const bookingCandidate = pickFirst(normalized, profile.columns.bookingDate).trim();
    if (!bookingCandidate) return;

    let bookingDate: string;
    try {
      bookingDate = parseFlexibleDate(bookingCandidate);
    } catch {
      return;
    }

    let valutaDate: string | undefined;
    const valutaCandidate = pickFirst(normalized, profile.columns.valutaDate).trim();
    if (valutaCandidate) {
      try {
        valutaDate = parseFlexibleDate(valutaCandidate);
      } catch {
        valutaDate = undefined;
      }
    }

    const { decimalComma, thousandSep } = profile.formats;
    const amountAliases = profile.columns.amount ?? [];
    const creditAliases = profile.columns.credit ?? [];
    const debitAliases = profile.columns.debit ?? [];

    let amountCents = parseAmountCents(
      pickFirst(normalized, amountAliases),
      decimalComma,
      thousandSep,
    );

    if (profile.derive?.preferAmountFromCreditDebit || amountAliases.length === 0) {
      const creditValue = parseAmountCents(
        pickFirst(normalized, creditAliases),
        decimalComma,
        thousandSep,
      );
      const debitValue = parseAmountCents(
        pickFirst(normalized, debitAliases),
        decimalComma,
        thousandSep,
      );
      const computed = creditValue - debitValue;
      if (computed !== 0 || amountAliases.length === 0) {
        amountCents = computed;
      }
    }

    if (Number.isNaN(amountCents)) {
      amountCents = 0;
    }

    const skipZero = profile.rules?.skipIfZeroAmount ?? true;
    if (skipZero && Math.abs(amountCents) === 0) {
      return;
    }

    const textFields = pickAll(normalized, profile.columns.text);
    const statusFields = STATUS_HEADER_ALIASES.map(alias =>
      normalized.get(alias) ?? '',
    ).filter(Boolean);
    if (matchesPendingWord([...textFields, ...statusFields], profile.rules)) {
      return;
    }

    const counterparty = pickFirst(normalized, profile.columns.counterparty).trim();
    const ibanRaw = pickFirst(normalized, profile.columns.iban).replace(/\s+/g, '').toUpperCase();
    const accountIban = ibanRaw || null;

    const currency = (
      pickFirst(normalized, profile.columns.currency)?.trim().toUpperCase() || 'EUR'
    );

    const referenceRaw = pickFirst(normalized, profile.columns.referenceId).trim();
    const externalRaw = pickFirst(normalized, profile.columns.externalId).trim();
    const reference = referenceRaw || externalRaw || null;

    const rawTextCandidates = textFields.map(value => value.trim()).filter(Boolean);
    const rawText =
      rawTextCandidates.join(' ') || counterparty || 'Bank CSV';

    const rawRecord: Record<string, unknown> = {
      __source: 'csv_profile',
      __profile: profile.id,
      __index: index,
      ...record,
    };
    if (referenceRaw) rawRecord.referenceId = referenceRaw;
    if (externalRaw) rawRecord.externalId = externalRaw;

    const row: ParsedRow = {
      bookingDate,
      valutaDate: valutaDate ?? undefined,
      amountCents,
      currency,
      direction: amountCents >= 0 ? 'in' : 'out',
      accountId: resolveAccountId(profile.derive?.accountIdTemplate, accountIban),
      accountIban,
      counterparty: counterparty || null,
      rawText,
      reference,
      raw: rawRecord,
    };

    const balanceRaw = pickFirst(normalized, profile.columns.balance).trim();
    const balanceValue = parseLocalizedAmount(balanceRaw, decimalComma, thousandSep);
    if (balanceValue !== null) {
      balances.push(balanceValue);
    }

    rows.push(row);
  });

  const result: ParseResult = {
    profileId: profile.id,
    confidence: 1,
    rows,
    warnings: [],
    candidates: [{ profileId: profile.id, confidence: 1 }],
  };

  if (balances.length > 0) {
    result.openingBalance = balances[0];
    result.closingBalance = balances[balances.length - 1];
  }

  return result;
}

