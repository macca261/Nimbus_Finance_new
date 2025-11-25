/**
 * Universal CSV Import Service
 * 
 * Automatically detects bank format, handles encoding, and imports transactions
 * into the database with deduplication and optional reconciliation.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import csv from 'csv-parser';
import iconv from 'iconv-lite';
import { Readable } from 'stream';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import { rawDb } from '../db';
import { detectEncoding, readFirstLines, findHeaderRow } from '../import/utils';
import { ImportStrategy, NormalizedTransaction } from '../import/strategies/ImportStrategy';
import { SparkasseStrategy } from '../import/strategies/SparkasseStrategy';
import { IngStrategy } from '../import/strategies/IngStrategy';
import { PayPalStrategy } from '../import/strategies/PayPalStrategy';
import { DKBStrategy } from '../import/strategies/DKBStrategy';
import { N26Strategy } from '../import/strategies/N26Strategy';
import { CommerzbankStrategy } from '../import/strategies/CommerzbankStrategy';
import { DKBOldStrategy } from '../import/strategies/DKBOldStrategy';

export interface ImportResult {
  success: boolean;
  strategy?: string;
  imported: number;
  skipped: number;
  errors: string[];
  pairedTransactions?: number; // Number of PayPal transactions paired with bank transactions
  potentialInternalTransfers?: number; // Number of potential internal transfers detected
}

export class ImportService {
  private strategies: ImportStrategy[];

  constructor() {
    // Register all available strategies (order matters - more specific first)
    this.strategies = [
      new DKBOldStrategy(), // Check old DKB format before new format
      new DKBStrategy(), // New DKB format (2024)
      new SparkasseStrategy(),
      new IngStrategy(),
      new PayPalStrategy(),
      new N26Strategy(),
      new CommerzbankStrategy(),
    ];
  }

  /**
   * Detect which strategy matches the CSV file using "Header Hunter" algorithm
   * Scans first 20 lines for known keywords to find the header row
   */
  private async detectStrategy(filePath: string): Promise<{ strategy: ImportStrategy; headerRowIndex: number } | null> {
    // Step 1: Detect encoding first
    const detectedEncoding = await detectEncoding(filePath);
    const encoding = detectedEncoding === 'latin1' ? 'latin1' : 'utf-8';

    // Step 2: Read first 20 lines with proper encoding
    const lines = readFirstLines(filePath, 20, encoding);
    
    if (lines.length === 0) {
      return null;
    }

    // Step 3: For each strategy, check if its required keywords exist in any line
    for (const strategy of this.strategies) {
      // Get required keywords from strategy (extract from matches logic)
      // For now, we'll use the matches method on each line
      for (let i = 0; i < lines.length; i++) {
        if (strategy.matches(lines[i])) {
          return { strategy, headerRowIndex: i };
        }
      }
    }

    return null;
  }

  /**
   * Import CSV file into database
   */
  async importFile(
    filePath: string,
    accountId: string,
    db: BetterSqliteDatabase = rawDb,
    options: {
      enableReconciliation?: boolean;
    } = {},
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      imported: 0,
      skipped: 0,
      errors: [],
    };

    try {
      // Step 1: Detect strategy and header row (includes encoding detection)
      const detection = await this.detectStrategy(filePath);
      if (!detection) {
        result.errors.push('Could not detect bank format. Please check CSV headers.');
        return result;
      }

      const { strategy, headerRowIndex } = detection;
      result.strategy = strategy.name;

      // Step 2: Detect encoding (already done in detectStrategy, but get it again for parsing)
      const detectedEncoding = await detectEncoding(filePath);
      const encoding = detectedEncoding === 'latin1' ? 'latin1' : 'utf-8';
      
      // Calculate skip lines based on header row index
      const skipLines = headerRowIndex;

      // Step 3: Parse CSV
      const transactions: NormalizedTransaction[] = [];
      const errors: string[] = [];

      await new Promise<void>((resolve, reject) => {
        const stream = fs.createReadStream(filePath)
          .pipe(iconv.decodeStream(encoding))
          .pipe(csv({
            separator: strategy.csvOptions.separator,
            skipLines: skipLines, // Use detected header row index
            headers: true,
            skipEmptyLines: true,
            mapHeaders: ({ header }: { header: string }) => header.trim(),
          }));

        stream.on('data', (row: any) => {
          try {
            const normalized = strategy.mapRow(row);
            if (normalized) {
              transactions.push(normalized);
            }
          } catch (err: any) {
            errors.push(`Row parsing error: ${err.message}`);
          }
        });

        stream.on('end', () => {
          resolve();
        });

        stream.on('error', (err) => {
          reject(err);
        });
      });

      if (errors.length > 0) {
        result.errors.push(...errors);
      }

      // Step 4: Batch insert with deduplication
      // Note: Using INSERT OR IGNORE with unique index on (bookingDate, valueDate, amountCents, purpose)
      const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO transactions (
          bookingDate,
          valueDate,
          amountCents,
          currency,
          purpose,
          counterpartName,
          payee,
          memo,
          externalId,
          accountId,
          createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      const insertMany = db.transaction((txs: NormalizedTransaction[]) => {
        let imported = 0;
        let skipped = 0;

        for (const tx of txs) {
          try {
            // Use externalId if available, otherwise generate synthetic
            const externalId = tx.externalId || null;

            // Try to insert
            // Note: valueDate defaults to bookingDate if not provided
            const info = insertStmt.run(
              tx.date,           // bookingDate
              tx.date,           // valueDate (same as bookingDate for CSV imports)
              tx.amountCents,
              tx.currency || 'EUR',
              tx.description || '', // purpose
              tx.payee || '',       // counterpartName
              tx.payee || '',       // payee
              tx.description || '', // memo
              externalId,
              accountId,
            );

            if (info.changes > 0) {
              imported++;
            } else {
              skipped++; // Duplicate (INSERT OR IGNORE)
            }
          } catch (err: any) {
            errors.push(`Insert error for ${tx.payee}: ${err.message}`);
          }
        }

        return { imported, skipped };
      });

      const insertResult = insertMany(transactions);
      result.imported = insertResult.imported;
      result.skipped = insertResult.skipped;

      // Step 5: Optional reconciliation scan for PayPal transactions
      if (options.enableReconciliation && strategy.name === 'PayPal') {
        result.pairedTransactions = await this.reconcilePayPalTransactions(db, accountId);
      }

      // Step 6: Detect potential internal transfers (double counts)
      result.potentialInternalTransfers = await this.detectInternalTransfers(db, accountId);

      result.success = true;
      return result;
    } catch (err: any) {
      result.errors.push(`Import failed: ${err.message}`);
      if (process.env.NODE_ENV !== 'production') {
        console.error('[ImportService] Import error:', err);
      }
      return result;
    }
  }

  /**
   * Reconciliation Scan: Link PayPal transactions with bank transactions
   * 
   * Looks for PayPal transactions (+/- X amount) and matching Bank transactions
   * (-/+ X amount) within a 3-day window to link them via paired_transaction_id.
   */
  private async reconcilePayPalTransactions(
    db: BetterSqliteDatabase,
    accountId: string,
  ): Promise<number> {
    try {
      // Find PayPal transactions that haven't been paired yet
      const paypalTxs = db.prepare(`
        SELECT id, bookingDate, amountCents, payee, memo
        FROM transactions
        WHERE accountId = ?
          AND (payee LIKE '%PayPal%' OR payee LIKE '%PAYPAL%')
          AND (pairedTransactionId IS NULL OR pairedTransactionId = '')
          AND bookingDate >= date('now', '-90 days')
      `).all(accountId) as Array<{
        id: number;
        bookingDate: string;
        amountCents: number;
        payee: string | null;
        memo: string | null;
      }>;

      let pairedCount = 0;

      for (const paypalTx of paypalTxs) {
        // Look for matching bank transaction (opposite amount, within 3 days)
        const oppositeAmount = -paypalTx.amountCents;
        const dateStart = new Date(paypalTx.bookingDate);
        dateStart.setDate(dateStart.getDate() - 3);
        const dateEnd = new Date(paypalTx.bookingDate);
        dateEnd.setDate(dateEnd.getDate() + 3);

        const matchingTx = db.prepare(`
          SELECT id
          FROM transactions
          WHERE accountId != ?
            AND amountCents = ?
            AND bookingDate BETWEEN ? AND ?
            AND (pairedTransactionId IS NULL OR pairedTransactionId = '')
            AND (payee NOT LIKE '%PayPal%' AND payee NOT LIKE '%PAYPAL%')
          LIMIT 1
        `).get(
          accountId,
          oppositeAmount,
          dateStart.toISOString().split('T')[0],
          dateEnd.toISOString().split('T')[0],
        ) as { id: number } | undefined;

        if (matchingTx) {
          // Link them bidirectionally
          db.prepare(`
            UPDATE transactions
            SET pairedTransactionId = ?
            WHERE id = ?
          `).run(matchingTx.id.toString(), paypalTx.id);

          db.prepare(`
            UPDATE transactions
            SET pairedTransactionId = ?
            WHERE id = ?
          `).run(paypalTx.id.toString(), matchingTx.id.toString());

          pairedCount++;
        }
      }

      return pairedCount;
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[ImportService] Reconciliation scan failed:', err);
      }
      return 0;
    }
  }

  /**
   * Detect potential internal transfers (double counts)
   * 
   * Finds transactions with same absolute amount and date but different sources,
   * which likely represent the same transfer seen from both sides.
   */
  private async detectInternalTransfers(
    db: BetterSqliteDatabase,
    accountId: string,
  ): Promise<number> {
    try {
      // Find transactions with same absolute amount and date but different sources
      const matches = db.prepare(`
        SELECT COUNT(DISTINCT t1.id) as count
        FROM transactions t1
        JOIN transactions t2 ON ABS(t1.amountCents) = ABS(t2.amountCents)
        WHERE t1.bookingDate = t2.bookingDate
          AND t1.id != t2.id
          AND t1.accountId = ?
          AND (t1.source != t2.source OR t1.sourceProfile != t2.sourceProfile)
          AND t1.isInternalTransfer = 0
          AND t2.isInternalTransfer = 0
      `).get(accountId) as { count: number } | undefined;

      return matches?.count || 0;
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[ImportService] Internal transfer detection failed:', err);
      }
      return 0;
    }
  }
}

// Export singleton instance
export const importService = new ImportService();

