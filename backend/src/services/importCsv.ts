import type { Database } from 'better-sqlite3';
import { insertTransactions, type CanonicalRow, db as defaultDb } from '../db';
import type { NormalizedTransaction } from '../types';

export type ImportDiagnostics = {
  profileId: string;
  confidence: number;
  filename: string;
  rowCount: number;
  inserted: number;
  duplicates: number;
  skipped: number;
  reasons: string[];
};

export function persistTransactions(input: {
  profileId: string;
  confidence: number;
  filename: string;
  transactions: NormalizedTransaction[];
  db?: Database;
}): ImportDiagnostics {
  const reasons: string[] = [];
  const canonicalRows: CanonicalRow[] = [];

  for (const tx of input.transactions) {
    if (!tx.bookingDate || !Number.isFinite(tx.amountCents)) {
      reasons.push(`skip: invalid row with bookingDate="${tx.bookingDate ?? ''}" amount="${tx.amountCents}"`);
      continue;
    }

    canonicalRows.push({
      publicId: tx.id,
      bookingDate: tx.bookingDate,
      valueDate: tx.valutaDate ?? tx.bookingDate,
      amountCents: tx.amountCents,
      currency: tx.currency ?? 'EUR',
      direction: tx.direction,
      purpose: tx.rawText ?? '',
      counterpartName: tx.counterparty ?? undefined,
      counterpartyIban: tx.counterpartyIban ?? undefined,
      accountIban: tx.accountIban ?? undefined,
      raw: tx.metadata ? { ...(tx.raw ?? {}), metadata: tx.metadata } : tx.raw ?? undefined,
      importFile: input.filename,
      bankProfile: tx.bankProfile,
      category: tx.category,
      categoryConfidence: tx.categoryConfidence,
      categorySource: tx.categorySource,
      categoryExplanation: tx.categoryExplanation,
      categoryRuleId: tx.categoryRuleId ?? undefined,
      source: tx.source ?? 'csv_bank',
      sourceProfile: tx.sourceProfile ?? tx.bankProfile,
      accountId: tx.accountId ?? undefined,
      payee: tx.payee ?? tx.counterparty ?? null,
      memo: tx.memo ?? tx.rawText ?? null,
      externalId: tx.externalId ?? null,
      referenceId: tx.referenceId ?? null,
      isTransfer: tx.isTransfer ?? false,
      transferLinkId: tx.transferLinkId ?? null,
      confidence: tx.categoryConfidence,
    });
  }

  const connection = input.db ?? defaultDb;
  const { inserted, duplicates } = insertTransactions(canonicalRows, connection);

  if (duplicates > 0) {
    reasons.push(`${duplicates} Transaction(s) were skipped as duplicates.`);
  }

  return {
    profileId: input.profileId,
    confidence: input.confidence,
    filename: input.filename,
    rowCount: input.transactions.length,
    inserted,
    duplicates,
    skipped: input.transactions.length - canonicalRows.length,
    reasons,
  };
}

