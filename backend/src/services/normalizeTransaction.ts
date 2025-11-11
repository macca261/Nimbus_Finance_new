import crypto from 'node:crypto';
import type { ParsedRow } from '../parser/types';
import type { CategorizeResult } from '../categorization';
import type { NormalizedTransaction } from '../types/transactions';

function fingerprint(row: ParsedRow, profileId: string): string {
  const parts = [
    profileId,
    row.bookingDate,
    row.valutaDate ?? '',
    String(row.amountCents),
    row.currency.toUpperCase(),
    (row.counterparty ?? '').trim().toLowerCase(),
    (row.counterpartyIban ?? '').replace(/\s+/g, '').toUpperCase(),
    row.rawText.trim().toLowerCase(),
  ];
  const data = parts.join('|');
  return crypto.createHash('sha256').update(data).digest('hex');
}

function toStringRecord(raw: Record<string, unknown> | undefined): Record<string, string> | undefined {
  if (!raw) return undefined;
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null) continue;
    output[key] = String(value);
  }
  return Object.keys(output).length ? output : undefined;
}

export function toNormalizedTransaction(
  row: ParsedRow,
  profileId: string,
  category: CategorizeResult,
): NormalizedTransaction {
  const rawRecord = row.raw ?? {};
  const stringifiedRaw = toStringRecord(rawRecord);
  const externalIdValue = rawRecord['externalId'];
  const relatedExternalValue = rawRecord['relatedExternalId'];
  const externalId =
    typeof externalIdValue === 'string' && externalIdValue.trim().length > 0 ? externalIdValue : undefined;
  const relatedExternal =
    typeof relatedExternalValue === 'string' && relatedExternalValue.trim().length > 0
      ? relatedExternalValue
      : undefined;
  const source = profileId === 'paypal' ? 'csv_paypal' : 'csv_bank';

  return {
    id: fingerprint(row, profileId),
    bookingDate: row.bookingDate,
    valutaDate: row.valutaDate,
    amountCents: row.amountCents,
    currency: row.currency,
    direction: row.direction,
    accountIban: row.accountIban ?? undefined,
    accountId: row.accountId ?? undefined,
    counterparty: row.counterparty ?? null,
    counterpartyIban: row.counterpartyIban ?? null,
    mcc: row.mcc ?? null,
    rawText: row.rawText,
    bankProfile: profileId,
    category: category.category,
    categoryConfidence: category.confidence,
    categorySource: category.source,
    categoryRuleId: category.ruleId,
    categoryExplanation: category.explanation,
    raw: stringifiedRaw,
    source,
    sourceProfile: profileId,
    payee: row.counterparty ?? null,
    memo: row.rawText,
    externalId,
    referenceId: typeof row.reference === 'string' ? row.reference : relatedExternal,
    isTransfer: false,
    isInternalTransfer: false,
    transferLinkId: null,
    confidence: category.confidence,
    metadata: undefined,
  };
}


