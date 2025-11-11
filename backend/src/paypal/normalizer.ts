import type { Transaction } from '../types/core';
import type { NormalizedTransaction } from '../types/transactions';
import type { CategorizeResult } from '../categorization';

function toStringRecord(raw: Record<string, unknown> | undefined): Record<string, string> | undefined {
  if (!raw) return undefined;
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null) continue;
    output[key] = String(value);
  }
  return Object.keys(output).length ? output : undefined;
}

export function normalizePaypalTransaction(tx: Transaction, category: CategorizeResult): NormalizedTransaction {
  const raw = toStringRecord(tx.raw as Record<string, unknown> | undefined);
  const metadata: Record<string, string | number | boolean | null> = {};
  if (raw?.paypalCategoryReason) {
    metadata.paypalCategoryReason = raw.paypalCategoryReason;
  }
  if (tx.isTransferLikeHint) {
    metadata.transferHint = true;
  }

  return {
    id: tx.id,
    bookingDate: tx.bookingDate,
    valutaDate: tx.valueDate,
    amountCents: tx.amountCents,
    currency: tx.currency,
    direction: tx.amountCents >= 0 ? 'in' : 'out',
    accountId: tx.accountId,
    counterparty: tx.counterparty ?? tx.payee ?? null,
    rawText: tx.memo ?? '',
    bankProfile: tx.sourceProfile ?? 'paypal',
    category: category.category,
    categoryConfidence: category.confidence,
    categorySource: category.source,
    categoryRuleId: category.ruleId,
    categoryExplanation: category.explanation,
    raw,
    source: 'csv_paypal',
    sourceProfile: tx.sourceProfile ?? 'paypal',
    payee: tx.payee ?? null,
    memo: tx.memo ?? null,
    externalId: tx.externalId ?? null,
    referenceId: tx.referenceId ?? null,
    isTransfer: tx.isTransferLikeHint ?? false,
    isInternalTransfer:
      category.category === 'transfer_internal' ||
      (category.category ? category.category.startsWith('internal') : false),
    transferLinkId: tx.transferLinkId ?? null,
    confidence: category.confidence,
    metadata: Object.keys(metadata).length ? metadata : undefined,
  };
}

export function normalizePaypalTransactions(entries: Array<{ tx: Transaction; category: CategorizeResult }>): NormalizedTransaction[] {
  return entries.map(entry => normalizePaypalTransaction(entry.tx, entry.category));
}
