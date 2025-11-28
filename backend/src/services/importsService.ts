import type { Database } from '../db';
import { db as defaultDb } from '../db';

export type ImportStatus = 'processing' | 'complete' | 'failed';

export interface ImportRow {
  id: number;
  filename: string;
  fileHash: string | null;
  createdAt: string;
  rowCount: number;
  status: ImportStatus;
  warnings: string[];
}

export interface DeleteResult {
  deleted: boolean;
  deletedTransactions: number;
}

export function listImports(limit = 50, conn: Database = defaultDb): ImportRow[] {
  const stmt = conn.prepare(`
    SELECT
      id,
      fileName,
      fileHash,
      createdAt,
      COALESCE(rowCount, transactionCount, 0) AS rowCount,
      status,
      warnings
    FROM imports
    ORDER BY datetime(createdAt) DESC
    LIMIT ?
  `);

  const rows = stmt.all(limit) as Array<{
    id: number;
    fileName: string;
    fileHash: string | null;
    createdAt: string;
    rowCount: number | null;
    status: string | null;
    warnings: string | null;
  }>;

  return rows.map(row => ({
    id: row.id,
    filename: row.fileName,
    fileHash: row.fileHash ?? null,
    createdAt: row.createdAt,
    rowCount: row.rowCount ?? 0,
    status: (row.status ?? 'complete') as ImportStatus,
    warnings: row.warnings ? JSON.parse(row.warnings) : [],
  }));
}

export function deleteImportById(id: number, conn: Database = defaultDb): DeleteResult {
  const txCount = conn
    .prepare(`SELECT COUNT(1) AS cnt FROM transactions WHERE importId = ?`)
    .get(id) as { cnt?: number };

  const result = conn.prepare(`DELETE FROM imports WHERE id = ?`).run(id);
  const deleted = (result?.changes ?? 0) > 0;

  return {
    deleted,
    deletedTransactions: deleted ? txCount?.cnt ?? 0 : 0,
  };
}
