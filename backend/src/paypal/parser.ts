import { parse as parseCsv } from 'csv-parse/sync';
import { Transaction } from '../types/core';
import type { PaypalParseOptions } from './types';

const ACCEPTED_STATUSES = new Set(['completed', 'partially refunded', 'refunded']);

const COLUMN_ALIASES: Record<string, string[]> = {
  date: ['Date', 'Datum'],
  time: ['Time', 'Zeit'],
  timeZone: ['Time zone', 'Zeitzone'],
  name: ['Name', 'Name des Partners'],
  type: ['Type', 'Typ'],
  status: ['Status', 'Status'],
  currency: ['Currency', 'Währung'],
  gross: ['Gross', 'Brutto'],
  fee: ['Fee', 'Gebühr'],
  net: ['Net', 'Netto'],
  transactionId: ['Transaction ID', 'Transaktionscode'],
  referenceId: ['Reference Txn ID', 'Referenzcode'],
  fromEmail: ['From Email Address', 'Von (E-Mail-Adresse)'],
  toEmail: ['To Email Address', 'An (E-Mail-Adresse)'],
  itemTitle: ['Item Title', 'Artikelbezeichnung'],
  subject: ['Subject', 'Betreff'],
  note: ['Note', 'Hinweis'],
  balance: ['Balance', 'Kontostand'],
};

const TRANSFER_HINTS = /(transfer to bank|transfer from bank|bank transfer|payout|withdrawal|top.?up|auszahlung|auf bankkonto|geld abbuchung)/i;
const FEE_HINT = /fee|gebühr/i;
const REFUND_HINT = /(refund|chargeback|reversal)/i;
const HOLD_HINT = /(hold|freigabe|release)/i;

export function parsePaypalCsv(csv: string, opts: PaypalParseOptions): Transaction[] {
  const content = normalizeInput(csv);
  const delimiter = detectDelimiter(content);
  const records = parseCsv(content, {
    columns: true,
    delimiter,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as Record<string, string>[];

  return records
    .map((row, index) => mapRowToTransaction(row, index, opts))
    .filter((tx): tx is Transaction => Boolean(tx));
}

function mapRowToTransaction(row: Record<string, string>, index: number, opts: PaypalParseOptions): Transaction | null {
  const dateRaw = getField(row, 'date');
  if (!dateRaw) return null;

  const bookingDate = parseBookingDate(dateRaw, getField(row, 'time'), getField(row, 'timeZone'));
  const currency = (getField(row, 'currency') || 'EUR').toUpperCase();
  const type = getField(row, 'type') ?? '';
  const status = getField(row, 'status') ?? '';
  const statusNormalized = status.trim().toLowerCase();
  if (statusNormalized && !ACCEPTED_STATUSES.has(statusNormalized)) {
    return null;
  }
  const itemTitle = getField(row, 'itemTitle') ?? '';
  const subject = getField(row, 'subject') ?? '';
  const note = getField(row, 'note') ?? '';
  const grossStr = getField(row, 'gross');
  const feeStr = getField(row, 'fee');
  const netStr = getField(row, 'net');

  let amountCents = parseMoneyToCents(netStr);
  if (amountCents === 0 && (grossStr || feeStr)) {
    const grossCents = parseMoneyToCents(grossStr);
    const feeCents = parseMoneyToCents(feeStr);
    if (grossCents !== 0 || feeCents !== 0) {
      amountCents = grossCents - feeCents;
    }
  }

  const name = getField(row, 'name');
  const toEmail = getField(row, 'toEmail');
  const fromEmail = getField(row, 'fromEmail');
  const payee = selectFirst([name, toEmail, fromEmail, subject]);

  const memoParts = [type, status, itemTitle, subject, note]
    .map(part => part?.trim())
    .filter(Boolean);
  const memo = memoParts.length ? memoParts.join(' | ') : null;

  const externalId = cleanString(getField(row, 'transactionId')) || undefined;
  const referenceId = cleanString(getField(row, 'referenceId')) || undefined;

  const normalizedType = (type || '').toLowerCase();
  const isTransfer = Boolean(normalizedType && TRANSFER_HINTS.test(normalizedType));
  const isFee = Boolean(normalizedType && FEE_HINT.test(normalizedType));
  const isRefund = Boolean(normalizedType && REFUND_HINT.test(normalizedType));
  const isHold = Boolean(normalizedType && HOLD_HINT.test(normalizedType));

  const raw: Record<string, unknown> = {
    ...row,
    paypalType: type,
    paypalStatus: status,
    paypalFlags: buildFlags({ isTransfer, isFee, isRefund, isHold }),
  };

  const idSource = externalId ?? referenceId ?? `${bookingDate}:${amountCents}:${index}`;
  const transaction: Transaction = {
    id: `paypal:${idSource}`,
    source: 'csv_paypal',
    sourceProfile: opts.profile ?? 'paypal',
    accountId: opts.accountId,
    bookingDate,
    valueDate: bookingDate,
    amountCents,
    currency,
    payee: payee ?? null,
    counterparty: payee ?? null,
    memo,
    externalId,
    referenceId,
    isTransferLikeHint: isTransfer || undefined,
    raw,
  };

  if (isFee) {
    raw.paypalFeeCandidate = true;
  }
  if (isRefund) {
    raw.paypalRefundCandidate = true;
  }
  if (isHold) {
    raw.paypalHoldCandidate = true;
  }

  return transaction;
}

function normalizeInput(csv: string): string {
  return csv.replace(/\uFEFF/g, '').replace(/\r\n?/g, '\n');
}

function detectDelimiter(content: string): string {
  const lines = content.split('\n').slice(0, 5);
  let delimiter: string = ',';
  let maxDiff = -Infinity;
  for (const candidate of [',', ';', '\t']) {
    const score = lines.reduce((acc, line) => acc + (line.split(candidate).length - 1), 0);
    if (score > maxDiff) {
      maxDiff = score;
      delimiter = candidate;
    }
  }
  return delimiter;
}

function getField(row: Record<string, string>, key: keyof typeof COLUMN_ALIASES): string | undefined {
  const aliases = COLUMN_ALIASES[key] ?? [];
  for (const alias of aliases) {
    if (alias in row && row[alias] !== undefined) {
      return row[alias];
    }
  }
  return undefined;
}

function selectFirst(values: Array<string | undefined | null>): string | null {
  for (const value of values) {
    if (value && value.trim().length > 0) return value.trim();
  }
  return null;
}

function cleanString(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseBookingDate(dateStr: string, timeStr?: string, _tz?: string): string {
  const trimmed = dateStr.trim();
  let iso: string | null = null;

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split('.');
    iso = `${year}-${pad2(month)}-${pad2(day)}`;
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    iso = trimmed;
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const [month, day, year] = trimmed.split('/');
    iso = `${year}-${pad2(month)}-${pad2(day)}`;
  } else {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      iso = parsed.toISOString().slice(0, 10);
    }
  }

  if (!iso) {
    return trimmed;
  }

  if (!timeStr || !timeStr.trim()) {
    return iso;
  }

  const time = normalizeTime(timeStr);
  if (!time) return iso;

  const combined = new Date(`${iso}T${time}Z`);
  if (Number.isNaN(combined.getTime())) return iso;
  return combined.toISOString().slice(0, 10);
}

function pad2(value: string): string {
  return value.padStart(2, '0');
}

function normalizeTime(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  return null;
}

function parseMoneyToCents(value?: string): number {
  if (!value) return 0;
  const trimmed = value.replace(/[\s\u00A0]/g, '').replace(/["']/g, '');
  if (!trimmed) return 0;

  const negative = /^-/.test(trimmed) || /\(.*\)/.test(trimmed);
  const cleaned = trimmed.replace(/[()]/g, '').replace(/[^0-9.,-]/g, '');

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let decimalSeparator = '';
  if (lastComma > lastDot) decimalSeparator = ',';
  else if (lastDot > lastComma) decimalSeparator = '.';

  let normalized = cleaned;
  if (decimalSeparator) {
    const integerPart = cleaned
      .slice(0, Math.max(lastComma, lastDot))
      .replace(/[^0-9-]/g, '');
    const fractionalPart = cleaned.slice(Math.max(lastComma, lastDot) + 1).replace(/[^0-9]/g, '');
    normalized = `${integerPart}.${fractionalPart}`;
  } else {
    normalized = cleaned.replace(/[^0-9-]/g, '');
  }

  const floatValue = Number.parseFloat(normalized);
  if (!Number.isFinite(floatValue)) return 0;
  const cents = Math.round(floatValue * 100);
  return negative ? -Math.abs(cents) : Math.abs(cents);
}

function buildFlags(flags: { isTransfer: boolean; isFee: boolean; isRefund: boolean; isHold: boolean }): string[] {
  const list: string[] = [];
  if (flags.isTransfer) list.push('transfer');
  if (flags.isFee) list.push('fee');
  if (flags.isRefund) list.push('refund');
  if (flags.isHold) list.push('hold');
  return list;
}
