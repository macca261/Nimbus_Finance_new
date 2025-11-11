import crypto from 'node:crypto';
import { matchInternalTransfers } from '../matching/transferMatcher';
import {
  db as defaultDb,
  fetchTransactionsForMatching,
  insertTransferLinkRecord,
  markTransactionAsTransfer,
  type Database,
} from '../db';
import type { TransferLink } from '../types/core';

export function runTransferMatching(conn: Database = defaultDb): TransferLink[] {
  const { paypal, bank } = fetchTransactionsForMatching(conn);
  if (!paypal.length || !bank.length) {
    return [];
  }

  const { links, updated } = matchInternalTransfers(paypal, bank);
  if (!links.length) {
    return [];
  }

  const updatedById = new Map(updated.map(tx => [tx.id, tx] as const));
  const persisted: TransferLink[] = [];

  for (const link of links) {
    const linkId = crypto.randomUUID();
    const finalLink: TransferLink = { ...link, id: linkId, createdAt: new Date().toISOString() };
    insertTransferLinkRecord(finalLink, conn);

    const from = updatedById.get(link.fromTxId);
    const to = updatedById.get(link.toTxId);

    if (from) {
      markTransactionAsTransfer({ publicId: from.id, transferLinkId: linkId, categoryId: from.category, confidence: link.score }, conn);
    }
    if (to) {
      markTransactionAsTransfer({ publicId: to.id, transferLinkId: linkId, categoryId: to.category, confidence: link.score }, conn);
    }

    persisted.push(finalLink);
  }

  return persisted;
}
