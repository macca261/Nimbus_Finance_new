/**
 * Universal CSV Import Service
 * 
 * Automatically detects bank format, handles encoding, and imports transactions
 * into the database with deduplication and optional reconciliation.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Database as BetterSqliteDatabase } from 'better-sqlite3';
import { rawDb, insertTransactions } from '../db';
import { parseBankCsv } from '../csv/parseBankCsv';
import type { CanonicalTransaction } from '@nimbus/shared/src/types/canonical';
import type { DetectionScore } from '../csv/types';

export interface ImportResult {
  success: boolean;
  strategy?: string;
  imported: number;
  skipped: number;
  errors: string[];
  pairedTransactions?: number; // Number of PayPal transactions paired with bank transactions
  potentialInternalTransfers?: number; // Number of potential internal transfers detected
  reason?: 'all_duplicates' | 'parse_error' | 'unsupported_format' | null; // Reason code for import result
  detectionScores?: DetectionScore[];
  header?: string[];
}

export class ImportService {
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
      // Map win1252 to latin1 for iconv-lite (they're compatible for our use case)
      const encoding = detectedEncoding === 'win1252' || detectedEncoding === 'latin1' 
        ? 'latin1' 
        : 'utf-8';
      
      // Calculate skip lines based on header row index
      const skipLines = headerRowIndex;

      // Step 3: Parse CSV
      const transactions: NormalizedTransaction[] = [];
      const errors: string[] = [];
      let rowCount = 0;
      let skippedCount = 0;

      const parser = csvParse({
        delimiter: strategy.csvOptions.separator,
        from_line: skipLines + 1, // csv-parse is 1-based and includes header row
        columns: (headers: string[]) => {
          const cleanedHeaders = headers.map(h => h.trim().replace(/^["']|["']$/g, ''));
          if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.log('[ImportService] Detected CSV headers:', cleanedHeaders);
          }
          return cleanedHeaders;
        },
        skip_empty_lines: true,
        bom: true,
        relax_quotes: true,
        relax_column_count: true,
        trim: true,
      });

      try {
        const decodedStream = fs.createReadStream(filePath).pipe(iconv.decodeStream(encoding));
        const stream = decodedStream.pipe(parser);

        for await (const row of stream) {
          rowCount++;

          if (process.env.NODE_ENV !== 'production' && rowCount <= 3) {
            // eslint-disable-next-line no-console
            console.log(`[ImportService] CSV row ${rowCount} sample:`, {
              keys: Object.keys(row),
              sample: {
                Buchungstag: String(row['Buchungstag'] || '').substring(0, 20),
                'Umsatz in EUR': String(row['Umsatz in EUR'] || '').substring(0, 20),
                'Wertstellung (Valuta)': String(row['Wertstellung (Valuta)'] || '').substring(0, 20),
                Vorgang: String(row['Vorgang'] || '').substring(0, 30),
                Buchungstext: String(row['Buchungstext'] || '').substring(0, 50),
              },
            });
          }

          try {
            const normalized = strategy.mapRow(row);
            if (normalized) {
              transactions.push(normalized);
            } else {
              skippedCount++;
              if (process.env.NODE_ENV !== 'production' && skippedCount <= 5) {
                // eslint-disable-next-line no-console
                console.warn('[ImportService] Row skipped by strategy:', {
                  rowIndex: rowCount,
                  allKeys: Object.keys(row),
                  date: row['Buchungstag'] || 'NOT FOUND',
                  amount: row['Umsatz in EUR'] || row['Betrag'] || row['Umsatz'] || 'NOT FOUND',
                  buchungstext: String(row['Buchungstext'] || '').substring(0, 50),
                });
              }
            }
          } catch (err: any) {
            errors.push(`Row ${rowCount} parsing error: ${err.message}`);
            if (process.env.NODE_ENV !== 'production') {
              // eslint-disable-next-line no-console
              console.error('[ImportService] Row parsing error:', {
                rowIndex: rowCount,
                error: err.message,
                stack: err.stack?.substring(0, 200),
                rowSample: {
                  keys: Object.keys(row),
                  date: row['Buchungstag'],
                  amount: row['Umsatz in EUR'],
                },
              });
            }
          }
        }
      } catch (streamError: any) {
        console.error('[ImportService] CSV parsing failed:', {
          error: streamError.message,
          stack: streamError.stack,
        });
        throw streamError;
      } finally {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.log('[ImportService] CSV parsing complete:', {
            totalRows: rowCount,
            validTransactions: transactions.length,
            skipped: skippedCount,
            errors: errors.length,
          });
        }
      }

      if (errors.length > 0) {
        result.errors.push(...errors);
      }

      // Step 4: Convert NormalizedTransaction to CanonicalRow and insert using proper function
      // Add dev-only logging
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[ImportService] parsed rows:', transactions.length);
      }

      if (transactions.length === 0) {
        result.success = false;
        result.reason = 'parse_error';
        
        // Provide helpful error message based on what we know
        if (rowCount === 0) {
          result.errors.push('No data rows found in CSV file. Please check that the file contains transaction data.');
        } else if (skippedCount === rowCount) {
          result.errors.push(`All ${rowCount} rows were skipped. This may indicate: incorrect date/amount format, missing required columns, or all zero-amount transactions.`);
          if (process.env.NODE_ENV !== 'production') {
            result.errors.push(`Strategy detected: ${strategy.name}, Header row index: ${headerRowIndex}, Encoding: ${encoding}`);
          }
        } else {
          result.errors.push(`No valid transactions found after parsing ${rowCount} rows. ${errors.length > 0 ? `Encountered ${errors.length} parsing errors.` : ''}`);
        }
        
        if (errors.length > 0 && errors.length <= 5) {
          result.errors.push(...errors.slice(0, 5));
        }
        
        return result;
      }

      // Map NormalizedTransaction to CanonicalRow
      const canonicalRows: CanonicalRow[] = [];
      const fileName = path.basename(filePath);

      for (const tx of transactions) {
        try {
          // Categorize transaction
          const textParts = [
            tx.description || '',
            tx.payee || '',
          ].filter((value): value is string => Boolean(value && value.toString().trim()));
          
          const categoryResult = categorize({
            text: textParts.join(' '),
            amount: tx.amountCents / 100,
            amountCents: tx.amountCents,
            iban: null,
            counterpart: tx.payee || null,
            memo: tx.description || '',
            payee: tx.payee || null,
            source: 'csv_bank',
          });

          // Generate publicId from externalId or create hash
          const publicId = tx.externalId || crypto
            .createHash('sha256')
            .update(`${tx.date}|${tx.amountCents}|${tx.description}|${tx.payee}`)
            .digest('hex')
            .substring(0, 16);

          const canonicalRow: CanonicalRow = {
            publicId,
            bookingDate: tx.date,
            valueDate: tx.date,
            amountCents: tx.amountCents,
            currency: tx.currency || 'EUR',
            direction: tx.amountCents >= 0 ? 'in' : 'out',
            purpose: tx.description || '',
            counterpartName: tx.payee || undefined,
            payee: tx.payee || null,
            memo: tx.description || null,
            externalId: tx.externalId || null,
            accountId: accountId || undefined,
            importFile: fileName,
            importBatchId: null,
            category: categoryResult.category || null,
            categoryConfidence: categoryResult.confidence || null,
            categorySource: categoryResult.source || null,
            categoryExplanation: categoryResult.explanation || null,
            categoryRuleId: categoryResult.ruleId || undefined,
            source: 'csv_bank',
            sourceProfile: strategy.name.toLowerCase(),
            bankProfile: strategy.name.toLowerCase(),
          };

          canonicalRows.push(canonicalRow);
        } catch (err: any) {
          errors.push(`Mapping error for transaction: ${err.message}`);
          if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.warn('[ImportService] Failed to map transaction:', err);
          }
        }
      }

      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[ImportService] candidate inserts:', canonicalRows.length, 'errors:', errors.length);
      }

      // Insert using the proper insertTransactions function
      let inserted = 0;
      let duplicates = 0;
      try {
        const insertResult = insertTransactions(canonicalRows, db);
        inserted = insertResult.inserted;
        duplicates = insertResult.duplicates;
        
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.log('[ImportService] insert result:', {
            inserted,
            duplicates,
            total: canonicalRows.length,
          });
        }
      } catch (dbError: any) {
        console.error('[ImportService] Database insert failed:', {
          error: dbError.message,
          stack: dbError.stack,
          transactionCount: canonicalRows.length,
        });
        result.errors.push(`Database error: ${dbError.message}`);
        result.success = false;
        result.reason = 'parse_error';
        return result;
      }

      result.imported = inserted;
      result.skipped = duplicates;
      
      // Determine reason code and success status
      if (inserted === 0 && duplicates > 0) {
        result.reason = 'all_duplicates';
        result.success = true; // Parsing succeeded, just all duplicates
      } else if (inserted === 0 && duplicates === 0 && canonicalRows.length > 0) {
        // Parsed rows but nothing inserted - this is unusual, likely a DB issue
        result.reason = 'parse_error';
        result.success = false;
        result.errors.push('Transactions were parsed but could not be inserted. This may indicate a database issue.');
      } else if (transactions.length === 0 && errors.length > 0) {
        result.reason = 'parse_error';
        result.success = false;
      } else if (!detection) {
        result.reason = 'unsupported_format';
        result.success = false;
      } else {
        result.success = true; // Successfully inserted at least one transaction
      }
      
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[ImportService] import result summary:', {
          strategy: result.strategy,
          parsedRows: transactions.length,
          canonicalRows: canonicalRows.length,
          inserted,
          duplicates,
          errors: errors.length,
          reason: result.reason,
          success: result.success,
          firstCanonicalRow: canonicalRows.length > 0 ? {
            bookingDate: canonicalRows[0].bookingDate,
            amountCents: canonicalRows[0].amountCents,
            payee: canonicalRows[0].payee?.substring(0, 30),
          } : null,
        });
      }

      // Step 5: Optional reconciliation scan for PayPal transactions
      if (options.enableReconciliation && strategy.name === 'PayPal') {
        try {
          result.pairedTransactions = await this.reconcilePayPalTransactions(db, accountId);
        } catch (err) {
          // Don't fail import if reconciliation fails
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[ImportService] Reconciliation scan failed:', err);
          }
        }
      }

      // Step 6: Detect potential internal transfers (double counts)
      try {
        result.potentialInternalTransfers = await this.detectInternalTransfers(db, accountId);
      } catch (err) {
        // Don't fail import if detection fails
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[ImportService] Internal transfer detection failed:', err);
        }
      }

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

