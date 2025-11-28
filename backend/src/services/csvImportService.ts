/**
 * CSV Import helper that now uses the centralized parseBankCsv pipeline for decoding,
 * delimiter detection, header matching, and bank-specific parsing.
 */
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'node:crypto';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import { rawDb, insertTransactions, type CanonicalRow } from '../db';
import { parseBankCsv } from '../csv/parseBankCsv';
import type { CanonicalTransaction } from '@nimbus/shared/src/types/canonical';
import type { ImportResult } from './ImportService';

const DEFAULT_CURRENCY = 'EUR';

function toCanonicalRow(
  tx: CanonicalTransaction,
  accountId: string,
  fileName: string,
  signatureName: string,
): CanonicalRow {
  const amountCents = Math.round(tx.amount * 100);

  return {
    id: tx.id,
    publicId: tx.id,
    bookingDate: tx.bookingDate,
    valueDate: tx.valueDate ?? tx.bookingDate,
    amountCents,
    currency: tx.currency || DEFAULT_CURRENCY,
    direction: amountCents >= 0 ? 'in' : 'out',
    purpose: tx.purpose,
    counterpartName: tx.counterpartName,
    counterpartyIban: tx.counterpartIban,
    rawCode: tx.rawCode,
    importFile: fileName,
    source: 'bank_csv',
    sourceProfile: signatureName.toLowerCase(),
    accountId,
    payee: tx.counterpartName ?? null,
    memo: tx.purpose ?? null,
  };
}

async function reconcilePayPalTransactions(
  db: BetterSqliteDatabase,
  accountId: string,
): Promise<number> {
  try {
    const paypalTxs = db
      .prepare(
        `
        SELECT id, bookingDate, amountCents
        FROM transactions
        WHERE accountId = ?
          AND (payee LIKE '%PayPal%' OR payee LIKE '%PAYPAL%')
          AND (pairedTransactionId IS NULL OR pairedTransactionId = '')
          AND bookingDate >= date('now', '-90 days')
      `,
      )
      .all(accountId) as Array<{ id: string; bookingDate: string; amountCents: number }>;

    let pairedCount = 0;

    for (const paypalTx of paypalTxs) {
      const oppositeAmount = -paypalTx.amountCents;
      const dateStart = new Date(paypalTx.bookingDate);
      dateStart.setDate(dateStart.getDate() - 3);
      const dateEnd = new Date(paypalTx.bookingDate);
      dateEnd.setDate(dateEnd.getDate() + 3);

      const matchingTx = db
        .prepare(
          `
          SELECT id
          FROM transactions
          WHERE accountId != ?
            AND amountCents = ?
            AND bookingDate BETWEEN ? AND ?
            AND (pairedTransactionId IS NULL OR pairedTransactionId = '')
            AND (payee NOT LIKE '%PayPal%' AND payee NOT LIKE '%PAYPAL%')
          LIMIT 1
        `,
        )
        .get(
          accountId,
          oppositeAmount,
          dateStart.toISOString().split('T')[0],
          dateEnd.toISOString().split('T')[0],
        ) as { id: string } | undefined;

      if (matchingTx) {
        db.prepare(`UPDATE transactions SET pairedTransactionId = ? WHERE id = ?`).run(
          matchingTx.id,
          paypalTx.id,
        );
        db.prepare(`UPDATE transactions SET pairedTransactionId = ? WHERE id = ?`).run(
          paypalTx.id,
          matchingTx.id,
        );
        pairedCount++;
      }
    }

    return pairedCount;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[csvImportService] Reconciliation scan failed:', err);
    }
    return 0;
  }
}

async function detectInternalTransfers(
  db: BetterSqliteDatabase,
  accountId: string,
): Promise<number> {
  try {
    const matches = db
      .prepare(
        `
        SELECT COUNT(DISTINCT t1.id) as count
        FROM transactions t1
        JOIN transactions t2 ON ABS(t1.amountCents) = ABS(t2.amountCents)
        WHERE t1.bookingDate = t2.bookingDate
          AND t1.id != t2.id
          AND t1.accountId = ?
          AND (t1.source != t2.source OR t1.sourceProfile != t2.sourceProfile)
          AND t1.isInternalTransfer = 0
          AND t2.isInternalTransfer = 0
      `,
      )
      .get(accountId) as { count: number } | undefined;

    return matches?.count ?? 0;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[csvImportService] Internal transfer detection failed:', err);
    }
    return 0;
  }
}

export async function importBankCsv(
  filePath: string,
  accountId: string,
  db?: BetterSqliteDatabase,
  options: { enableReconciliation?: boolean } = {},
): Promise<ImportResult> {
  // Be defensive: some callers might pass `undefined` for db.
  const conn: BetterSqliteDatabase = db ?? rawDb;

  const result: ImportResult = {
    success: false,
    imported: 0,
    skipped: 0,
    errors: [],
  };
  let importId: number | null = null;

  try {
    const buffer = await fs.promises.readFile(filePath);
    const parseResult = await parseBankCsv(buffer, path.basename(filePath));
    const signature = parseResult.bankSignature;

    if (!signature) {
      result.errors.push('Could not detect bank format. Unsupported CSV header.');
      result.reason = 'unsupported_format';
      return result;
    }

    result.strategy = signature.displayName;

    if (parseResult.warnings.length) {
      result.errors.push(
        ...parseResult.warnings.map((warning) => {
          const prefix = warning.rowIndex !== undefined ? 'Row ' + warning.rowIndex + ': ' : '';
          return prefix + warning.message;
        }),
      );
    }

    if (parseResult.transactions.length === 0) {
      result.errors.push('No transactions detected in CSV.');
      result.reason = 'parse_error';
      return result;
    }

    const fileName = path.basename(filePath);
    const canonicalRows = parseResult.transactions.map((tx) =>
      toCanonicalRow(tx, accountId, fileName, signature.displayName),
    );

    const warningsJson = JSON.stringify(parseResult.warnings ?? []);
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

    // 1) Register import in `imports` table
    try {
      const insertImportResult = conn
        .prepare(
          `
          INSERT INTO imports (
            profileId,
            fileName,
            confidence,
            transactionCount,
            warnings,
            batchId,
            fileHash,
            status,
            rowCount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        )
        .run('bank_csv', fileName, 1, 0, warningsJson, null, fileHash, 'processing', 0);
      importId = Number(insertImportResult.lastInsertRowid);
    } catch (importErr: any) {
      if (isDuplicateFileHash(importErr)) {
        result.errors.push('Diese CSV wurde bereits importiert.');
        result.reason = 'duplicate_import';
        return result;
      }
      throw importErr;
    }

    // 2) Insert transactions with importId
    const rowsWithImport: CanonicalRow[] = canonicalRows.map((row) => ({
      ...row,
      importId,
    }));

    let insertResult;
    try {
      insertResult = insertTransactions(rowsWithImport, conn);
    } catch (insertErr) {
      if (importId != null) {
        conn.prepare(`UPDATE imports SET status = 'failed' WHERE id = ?`).run(importId);
      }
      throw insertErr;
    }

    // 3) Update imports row with final stats
    conn
      .prepare(
        `
      UPDATE imports
      SET rowCount = @rowCount,
          transactionCount = @rowCount,
          status = @status,
          warnings = @warnings
      WHERE id = @id
    `,
      )
      .run({
        rowCount: insertResult.inserted,
        status: 'complete',
        warnings: warningsJson,
        id: importId,
      });

    result.imported = insertResult.inserted;
    result.skipped = insertResult.duplicates;

    if (insertResult.inserted === 0 && insertResult.duplicates === 0) {
      result.errors.push('No transactions imported (all rows skipped or duplicates).');
      result.reason = 'all_duplicates';
    }

    if (options.enableReconciliation) {
      result.pairedTransactions = await reconcilePayPalTransactions(conn, accountId);
    }

    result.potentialInternalTransfers = await detectInternalTransfers(conn, accountId);
    result.success = result.imported > 0 || result.skipped > 0;

    if (process.env.NODE_ENV !== 'production') {
      console.log('[csvImportService] importBankCsv result:', {
        strategy: result.strategy,
        imported: result.imported,
        skipped: result.skipped,
        reason: result.reason,
        errors: result.errors,
      });
    }

    return result;
  } catch (err: any) {
    if (importId != null) {
      try {
        conn.prepare(`UPDATE imports SET status = 'failed' WHERE id = ?`).run(importId);
      } catch {
        // ignore secondary failure
      }
    }
    result.errors.push('Import failed: ' + err.message);
    if (process.env.NODE_ENV !== 'production') {
      console.error('[csvImportService] Import error:', err);
    }
    return result;
  }
}

    result.strategy = signature.displayName;

    if (parseResult.warnings.length) {
      result.errors.push(
        ...parseResult.warnings.map((warning) => {
          const prefix = warning.rowIndex !== undefined ? 'Row ' + warning.rowIndex + ': ' : '';
          return prefix + warning.message;
        }),
      );
    }

    if (parseResult.transactions.length === 0) {
      result.errors.push('No transactions detected in CSV.');
      result.reason = 'parse_error';
      return result;
    }

    const fileName = path.basename(filePath);
    const canonicalRows = parseResult.transactions.map((tx) =>
      toCanonicalRow(tx, accountId, fileName, signature.displayName),
    );

    const warningsJson = JSON.stringify(parseResult.warnings ?? []);
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

    // 1) Register import in `imports` table
    try {
      const insertImportResult = db
        .prepare(
          `
          INSERT INTO imports (
            profileId,
            fileName,
            confidence,
            transactionCount,
            warnings,
            batchId,
            fileHash,
            status,
            rowCount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        )
        .run('bank_csv', fileName, 1, 0, warningsJson, null, fileHash, 'processing', 0);
      importId = Number(insertImportResult.lastInsertRowid);
    } catch (importErr: any) {
      if (isDuplicateFileHash(importErr)) {
        // Graceful duplicate-import handling
        result.errors.push('Diese CSV wurde bereits importiert.');
        result.reason = 'duplicate_import';
        return result;
      }
      throw importErr;
    }

    // 2) Insert transactions with importId
    const rowsWithImport: CanonicalRow[] = canonicalRows.map((row) => ({
      ...row,
      importId,
    }));

    let insertResult;
    try {
      insertResult = insertTransactions(rowsWithImport, db);
    } catch (insertErr) {
      if (importId != null) {
        db.prepare(`UPDATE imports SET status = 'failed' WHERE id = ?`).run(importId);
      }
      throw insertErr;
    }

    // 3) Update imports row with final stats
    db.prepare(
      `
      UPDATE imports
      SET rowCount = @rowCount,
          transactionCount = @rowCount,
          status = @status,
          warnings = @warnings
      WHERE id = @id
    `,
    ).run({
      rowCount: insertResult.inserted,
      status: 'complete',
      warnings: warningsJson,
      id: importId,
    });

    result.imported = insertResult.inserted;
    result.skipped = insertResult.duplicates;

    if (insertResult.inserted === 0 && insertResult.duplicates === 0) {
      result.errors.push('No transactions imported (all rows skipped or duplicates).');
      result.reason = 'all_duplicates';
    }

    if (options.enableReconciliation) {
      result.pairedTransactions = await reconcilePayPalTransactions(db, accountId);
    }

    result.potentialInternalTransfers = await detectInternalTransfers(db, accountId);
    result.success = result.imported > 0 || result.skipped > 0;

    if (process.env.NODE_ENV !== 'production') {
      // Helpful debug to see what happened
      console.log('[csvImportService] importBankCsv result:', {
        strategy: result.strategy,
        imported: result.imported,
        skipped: result.skipped,
        reason: result.reason,
        errors: result.errors,
      });
    }

    return result;
  } catch (err: any) {
    if (importId != null) {
      try {
        db.prepare(`UPDATE imports SET status = 'failed' WHERE id = ?`).run(importId);
      } catch {
        // ignore secondary failure
      }
    }
    result.errors.push('Import failed: ' + err.message);
    if (process.env.NODE_ENV !== 'production') {
      console.error('[csvImportService] Import error:', err);
    }
    return result;
  }
}

function isDuplicateFileHash(error: unknown): boolean {
  const code = (error as any)?.code;
  if (code !== 'SQLITE_CONSTRAINT' && code !== 'SQLITE_CONSTRAINT_UNIQUE') {
    return false;
  }
  const message = String((error as any)?.message ?? '');
  // Handle both the table-level and index-level messages
  return (
    message.includes('imports.fileHash') ||
    message.includes('idx_imports_fileHash')
  );
}

