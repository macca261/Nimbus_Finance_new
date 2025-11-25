/**
 * Import Adapter
 * 
 * Converts ImportService NormalizedTransaction to database CanonicalRow format
 */

import type { NormalizedTransaction } from './interfaces';
import type { CanonicalRow } from '../db';
import { txFingerprint } from '../db';

/**
 * Converts normalized transaction to canonical row for database insertion
 */
export function toCanonicalRow(
  normalized: NormalizedTransaction,
  filename: string,
  batchId?: string
): CanonicalRow {
  // Use hashId as fingerprint for deduplication
  const fingerprint = normalized.hashId;

  return {
    publicId: normalized.hashId, // Use hash as publicId for deduplication
    bookingDate: normalized.date,
    valueDate: normalized.date,
    amountCents: normalized.amountCents,
    currency: normalized.currency,
    direction: normalized.amountCents >= 0 ? 'in' : 'out',
    purpose: normalized.description,
    counterpartName: normalized.payee !== 'Unknown' ? normalized.payee : undefined,
    payee: normalized.payee !== 'Unknown' ? normalized.payee : undefined,
    memo: normalized.description,
    importFile: filename,
    importBatchId: batchId ?? null,
    bankProfile: 'csv_import',
    category: normalized.category ?? undefined,
    categoryConfidence: normalized.categoryConfidence ?? undefined,
    externalId: normalized.externalId ?? undefined,
    fingerprint, // Use hashId as fingerprint for deduplication
    // Store hashId in raw for reference
    raw: {
      hashId: normalized.hashId,
      source: 'csv_import',
    },
  };
}

