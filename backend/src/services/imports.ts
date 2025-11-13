import type { Database } from '../db';
import { db as defaultDb } from '../db';

export type ImportListItem = {
  id: number;
  batchId: string | null;
  profileId: string;
  fileName: string;
  confidence: number;
  transactionCount: number;
  warnings: string[];
  createdAt: string;
};

export type DeleteImportsResult = {
  deletedImports: number;
  deletedTransactions: number;
};

export function listImports(limit = 50, conn: Database = defaultDb): ImportListItem[] {
  const stmt = conn.prepare(
    `SELECT id, batchId, profileId, fileName, confidence, transactionCount, warnings, createdAt
     FROM imports
     ORDER BY datetime(createdAt) DESC
     LIMIT ?`
  );
  const rows = stmt.all(limit) as Array<{
    id: number;
    batchId: string | null;
    profileId: string;
    fileName: string;
    confidence: number;
    transactionCount: number;
    warnings: string | null;
    createdAt: string;
  }>;

  return rows.map(row => ({
    id: row.id,
    batchId: row.batchId ?? null,
    profileId: row.profileId,
    fileName: row.fileName,
    confidence: row.confidence,
    transactionCount: row.transactionCount,
    warnings: row.warnings ? (JSON.parse(row.warnings) as string[]) : [],
    createdAt: row.createdAt,
  }));
}

export function deleteImportsByIds(ids: Array<number | string>, conn: Database = defaultDb): DeleteImportsResult {
  const normalizedIds = Array.from(
    new Set(
      ids
        .map(id => Number(id))
        .filter(value => Number.isInteger(value) && value > 0)
    )
  );

  if (!normalizedIds.length) {
    return { deletedImports: 0, deletedTransactions: 0 };
  }

  const placeholders = normalizedIds.map(() => '?').join(',');
  const importRows = conn
    .prepare(`SELECT id, batchId, fileName FROM imports WHERE id IN (${placeholders})`)
    .all(...normalizedIds) as Array<{ id: number; batchId: string | null; fileName: string }>; 

  if (!importRows.length) {
    return { deletedImports: 0, deletedTransactions: 0 };
  }

  const txIdCollector: number[] = [];
  const selectTxByBatch = conn.prepare(`SELECT id FROM transactions WHERE importBatchId = ?`);
  const selectTxByFile = conn.prepare(`SELECT id FROM transactions WHERE importFile = ?`);

  importRows.forEach(row => {
    const rows = row.batchId
      ? (selectTxByBatch.all(row.batchId) as Array<{ id: number }>)
      : (selectTxByFile.all(row.fileName) as Array<{ id: number }>);
    for (const tx of rows) {
      txIdCollector.push(tx.id);
    }
  });

  const distinctTxIds = Array.from(new Set(txIdCollector));

  const deleteTransferByFrom = distinctTxIds.length
    ? conn.prepare(`DELETE FROM transfer_links WHERE fromTxId IN (${distinctTxIds.map(() => '?').join(',')})`)
    : null;
  const deleteTransferByTo = distinctTxIds.length
    ? conn.prepare(`DELETE FROM transfer_links WHERE toTxId IN (${distinctTxIds.map(() => '?').join(',')})`)
    : null;
  const deleteTransactionsStmt = distinctTxIds.length
    ? conn.prepare(`DELETE FROM transactions WHERE id IN (${distinctTxIds.map(() => '?').join(',')})`)
    : null;
  const deleteImportsStmt = conn.prepare(`DELETE FROM imports WHERE id IN (${placeholders})`);

  let deletedTransactions = 0;
  let deletedImports = 0;

  conn.exec('BEGIN');
  try {
    if (distinctTxIds.length) {
      const idStrings = distinctTxIds.map(id => String(id));
      if (deleteTransferByFrom) {
        deleteTransferByFrom.run(...idStrings);
      }
      if (deleteTransferByTo) {
        deleteTransferByTo.run(...idStrings);
      }
      if (deleteTransactionsStmt) {
        const txResult = deleteTransactionsStmt.run(...distinctTxIds);
        deletedTransactions = txResult.changes ?? 0;
      }
    }

    const importResult = deleteImportsStmt.run(...normalizedIds);
    deletedImports = importResult.changes ?? 0;

    conn.exec('COMMIT');
  } catch (error) {
    try {
      conn.exec('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw error;
  }

  return { deletedImports, deletedTransactions };
}
