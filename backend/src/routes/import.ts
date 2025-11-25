import { Router, type RequestHandler } from 'express';
import crypto from 'node:crypto';
import multer from 'multer';
import { parseBankCsv, ParseBankCsvError } from '../parser/parseBankCsv';
import { PayPalParseError } from '../parser/paypal';
import { recordImport, getAllOverrideRules, getRecentImports, db as defaultDb, insertTransactions } from '../db';
import { persistTransactions } from '../services/importCsv';
import { categorize } from '../categorization';
import { toNormalizedTransaction } from '../services/normalizeTransaction';
import { findMatchingOverride } from '../overrides/userOverrides';
import type { Transaction } from '../types/core';
import { runTransferMatching } from '../services/transferMatching';
import { ImportService } from '../import/ImportService';
import { toCanonicalRow } from '../import/adapter';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

export const importRouter = Router();

const handleImport: RequestHandler = async (req, res) => {
  const startTime = Date.now();
  let fileBytes = 0;
  let profileId = 'unknown';
  let rowCount = 0;
  let inserted = 0;

  try {
    console.info('[import] start', {
      hasFile: !!req.file,
      fieldName: req.file?.fieldname,
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
    });

    // Validate file field name is exactly "file"
    if (!req.file) {
      console.warn('[import] no file field in request');
      return res.status(400).json({
        code: 'BAD_REQUEST',
        message: 'No file uploaded',
      });
    }

    if (req.file.fieldname !== 'file') {
      console.warn('[import] wrong field name', { fieldname: req.file.fieldname });
      return res.status(400).json({
        code: 'BAD_REQUEST',
        message: `Expected field name "file", got "${req.file.fieldname}"`,
      });
    }

    if (!req.file.buffer || req.file.buffer.length === 0) {
      console.warn('[import] empty buffer');
      return res.status(400).json({
        code: 'BAD_REQUEST',
        message: 'No file uploaded',
      });
    }

    fileBytes = req.file.buffer.length;
    console.info('[import] received file', {
      bytes: fileBytes,
      fileName: req.file.originalname,
      mimetype: req.file.mimetype,
    });

    const buffer = req.file.buffer;
    const hint = typeof req.query.bank === 'string' ? req.query.bank : undefined;

    let result;
    try {
      result = await parseBankCsv(buffer, hint);
      profileId = result.profileId;
      rowCount = result.rows.length;
      console.info('[import] parsed', {
        profileId: result.profileId,
        confidence: result.confidence,
        rowCount: result.rows.length,
        warnings: result.warnings?.length ?? 0,
      });
    } catch (parseError) {
      console.error('[import] parse error', {
        error: parseError instanceof Error ? parseError.message : String(parseError),
        stack: parseError instanceof Error ? parseError.stack : undefined,
      });

      if (parseError instanceof PayPalParseError) {
        return res.status(400).json({
          code: 'PAYPAL_PARSE_ERROR',
          message: parseError.message,
          details: parseError.details ?? null,
        });
      }
      if (parseError instanceof ParseBankCsvError) {
        return res.status(400).json({
          code: 'BANK_PARSE_ERROR',
          message: parseError.message,
          hints: parseError.hints.length ? parseError.hints : undefined,
          candidates: parseError.candidates.length ? parseError.candidates : undefined,
          warnings: [],
        });
      }
      // Re-throw unknown parse errors to be caught by outer catch
      throw parseError;
    }

    if (!result.rows.length) {
      return res.status(400).json({
        code: 'IMPORT_EMPTY',
        message: 'Die Datei enthält keine erkennbaren Umsätze.',
        profileId: result.profileId,
        confidence: result.confidence,
        warnings: result.warnings ?? [],
        candidates: result.candidates,
      });
    }

    const importFile = req.file?.originalname ?? 'upload.csv';
    const batchId = crypto.randomUUID();

    const db = (req.app as any)?.locals?.db ?? defaultDb;
    const overrideRules = getAllOverrideRules(db);

    const normalized = result.rows.map((row, index) => {
      try {
        const combinedText = [row.rawText, row.counterparty, row.reference]
          .filter((value): value is string => Boolean(value && value.trim()))
          .join(' ');
        const source = result.profileId === 'paypal' ? 'csv_paypal' : 'csv_bank';
        const rawPayload: Record<string, unknown> = {
          counterpartyIban: row.counterpartyIban,
          accountIban: row.accountIban,
        };
        if (row.raw) {
          Object.assign(rawPayload, row.raw);
        }
        const rawRecord = row.raw ? (row.raw as Record<string, string | undefined>) : undefined;
        const extractRawField = (key: string): string | null => {
          if (!rawRecord) return null;
          const value = rawRecord[key];
          if (typeof value === 'string' && value.trim().length > 0) {
            return value;
          }
          return null;
        };
        const externalId = extractRawField('externalId');
        const relatedExternal = extractRawField('relatedExternalId');

        const txCandidate: Transaction = {
          id: `${result.profileId}:${row.bookingDate}:${row.amountCents}:${index}`,
          source,
          sourceProfile: result.profileId,
          accountId: row.accountId ?? row.accountIban ?? (result.profileId === 'paypal' ? 'paypal:wallet' : 'bank:unknown'),
          bookingDate: row.bookingDate,
          valueDate: row.valutaDate ?? row.bookingDate,
          amountCents: row.amountCents,
          currency: row.currency,
          payee: row.counterparty ?? null,
          counterparty: row.counterparty ?? null,
          memo: row.rawText,
          categoryId: undefined,
          confidence: undefined,
          externalId,
          referenceId: row.reference ?? relatedExternal ?? null,
          isTransfer: false,
          transferLinkId: null,
          raw: rawPayload,
        };
        const overrideMatch = findMatchingOverride(txCandidate, overrideRules);
        // Pass separate fields instead of combined text to allow proper rule matching
        // The categorization engine needs rawText, counterparty, and reference separately
        const category = categorize({
          text: row.rawText ?? '', // Use rawText directly, not combined text
          amount: row.amountCents / 100,
          amountCents: row.amountCents,
          iban: row.accountIban ?? null,
          counterpart: row.counterparty ?? null,
          payee: row.counterparty ?? null,
          memo: row.rawText, // Also pass as memo for backward compatibility
          source,
          transaction: txCandidate,
          overrideMatch: overrideMatch ? { ruleId: overrideMatch.rule.id, categoryId: overrideMatch.categoryId } : undefined,
        });
        
        // DEV: Debug logging for categorization (remove or guard with NODE_ENV later)
        if (process.env.NODE_ENV === 'development') {
          console.log('[categorize-debug]', {
            bookingDate: row.bookingDate,
            amountCents: row.amountCents,
            merchant: row.counterparty ?? null,
            rawText: row.rawText ?? null,
            combinedText: combinedText,
            categoryId: category.category,
            categorySource: category.source,
            categoryConfidence: category.confidence,
            ruleId: category.ruleId,
          });
        }
        
        return toNormalizedTransaction(row, result.profileId, category);
      } catch (categorizeError) {
        // Log and continue with categorySource='unknown' instead of 500
        console.warn('[import] categorization failed for row', {
          index,
          error: categorizeError instanceof Error ? categorizeError.message : String(categorizeError),
          bookingDate: row.bookingDate,
          amountCents: row.amountCents,
        });
        // Return row with unknown category
        return toNormalizedTransaction(row, result.profileId, {
          category: 'other',
          confidence: 0.1,
          source: 'fallback',
        });
      }
    });

    let diagnostics;
    try {
      diagnostics = persistTransactions({
        profileId: result.profileId,
        confidence: result.confidence,
        filename: importFile,
        transactions: normalized,
        db,
        batchId,
      });
      inserted = diagnostics.inserted;
      console.info('[import] persisted', {
        inserted: diagnostics.inserted,
        duplicates: diagnostics.duplicates,
        skipped: diagnostics.skipped,
        reasons: diagnostics.reasons,
      });
    } catch (persistError) {
      console.error('[import] persist error', {
        error: persistError instanceof Error ? persistError.message : String(persistError),
        stack: persistError instanceof Error ? persistError.stack : undefined,
      });
      // If it's a known duplicate-only scenario, return IMPORT_EMPTY
      if (persistError instanceof Error && persistError.message.includes('duplicate')) {
        return res.status(400).json({
          code: 'IMPORT_EMPTY',
          message: 'Keine gültigen Umsätze importiert.',
          profileId: result.profileId,
          confidence: result.confidence,
          rowCount: result.rows.length,
          reasons: ['Alle Transaktionen waren Duplikate'],
          warnings: result.warnings ?? [],
          candidates: result.candidates,
        });
      }
      // Re-throw to be caught by outer catch
      throw persistError;
    }

    try {
      runTransferMatching(db);
    } catch (matchingError) {
      // Transfer matching errors shouldn't fail the import
      console.warn('[import] transfer matching failed', {
        error: matchingError instanceof Error ? matchingError.message : String(matchingError),
      });
    }

    const duration = Date.now() - startTime;
    console.info('[import] complete', {
      profileId: diagnostics.profileId,
      confidence: diagnostics.confidence,
      rowCount: diagnostics.rowCount,
      inserted: diagnostics.inserted,
      duplicates: diagnostics.duplicates,
      skipped: diagnostics.skipped,
      file: importFile,
      duration: `${duration}ms`,
      reasons: diagnostics.reasons.join(' | '),
    });

    if (diagnostics.inserted === 0) {
      return res.status(400).json({
        code: 'IMPORT_EMPTY',
        message: 'Keine gültigen Umsätze importiert.',
        profileId: diagnostics.profileId,
        confidence: diagnostics.confidence,
        rowCount: diagnostics.rowCount,
        reasons: diagnostics.reasons,
        warnings: result.warnings ?? [],
        candidates: result.candidates,
        normalizerRulesActive: diagnostics.normalizerRulesActive,
      });
    }

    recordImport(
      {
        profileId: diagnostics.profileId,
        fileName: importFile,
        confidence: diagnostics.confidence,
        transactionCount: diagnostics.inserted,
        warnings: result.warnings ?? [],
        batchId,
      },
      db,
    );

    return res.json({
      code: 'OK',
      imported: diagnostics.inserted,
      warnings: result.warnings ?? [],
      ok: true,
      profileId: diagnostics.profileId,
      confidence: diagnostics.confidence,
      fileName: importFile,
      transactionCount: diagnostics.rowCount,
      insertedCount: diagnostics.inserted,
      duplicateCount: diagnostics.duplicates,
      skippedCount: diagnostics.skipped,
      reasons: diagnostics.reasons,
      candidates: result.candidates,
      openingBalance: result.openingBalance,
      closingBalance: result.closingBalance,
      normalizerRulesActive: diagnostics.normalizerRulesActive,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const err = error as { name?: string; message?: string; details?: unknown; stack?: string };

    console.error('[import] failed', {
      duration: `${duration}ms`,
      fileBytes,
      profileId,
      rowCount,
      inserted,
      error: {
        name: err?.name ?? 'UnknownError',
        message: err?.message ?? String(error),
        stack: err?.stack,
        details: err?.details,
      },
    });

    // These should have been caught earlier, but handle them here as fallback
    if (error instanceof PayPalParseError) {
      return res.status(400).json({
        code: 'PAYPAL_PARSE_ERROR',
        message: error.message,
        details: error.details ?? null,
      });
    }
    if (error instanceof ParseBankCsvError) {
      return res.status(400).json({
        code: 'BANK_PARSE_ERROR',
        message: error.message,
        hints: error.hints.length ? error.hints : undefined,
        candidates: error.candidates.length ? error.candidates : undefined,
        warnings: [],
      });
    }

    // Unknown error - log full stack for debugging
    const stackLines = err?.stack?.split('\n') ?? [];
    console.error('[import] unknown error stack (first 10 lines):', stackLines.slice(0, 10).join('\n'));

    return res.status(500).json({
      code: 'IMPORT_FAILED',
      message: 'Unbekannter Importfehler',
    });
  }
};

// Multer error handler
const multerErrorHandler = (err: any, req: any, res: any, next: any) => {
  if (err) {
    console.warn('[import] multer error', { error: err.message });
    return res.status(400).json({
      code: 'BAD_REQUEST',
      message: 'No file uploaded',
    });
  }
  next();
};

importRouter.post('/', upload.single('file'), multerErrorHandler, handleImport);

// New streaming import endpoint (uses Strategy Pattern)
importRouter.post('/stream', upload.single('file'), multerErrorHandler, async (req, res) => {
  const startTime = Date.now();
  
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        code: 'BAD_REQUEST',
        message: 'No file uploaded',
      });
    }

    console.info('[import/stream] start', {
      fileName: req.file.originalname,
      fileSize: req.file.buffer.length,
    });

    const importService = new ImportService();
    const result = await importService.detectAndParseBuffer(req.file.buffer);

    if (result.transactions.length === 0) {
      return res.status(400).json({
        code: 'IMPORT_EMPTY',
        message: 'Die Datei enthält keine erkennbaren Umsätze.',
        bank: result.bank,
      });
    }

    // Convert to canonical rows
    const batchId = crypto.randomUUID();
    const filename = req.file.originalname || 'upload.csv';
    const canonicalRows = result.transactions.map(tx => 
      toCanonicalRow(tx, filename, batchId)
    );

    // Insert into database (deduplication handled by fingerprint unique index)
    const db = (req.app as any)?.locals?.db ?? defaultDb;
    const { inserted, duplicates } = insertTransactions(canonicalRows, db);

    // Record import metadata
    const importId = recordImport(
      {
        profileId: result.bank,
        fileName: filename,
        confidence: 1.0, // High confidence for detected strategies
        transactionCount: result.transactions.length,
        warnings: result.skippedRows > 0 
          ? [`${result.skippedRows} Zeilen übersprungen`] 
          : [],
        batchId,
      },
      db
    );

    const duration = Date.now() - startTime;

    console.info('[import/stream] complete', {
      bank: result.bank,
      totalRows: result.totalRows,
      transactions: result.transactions.length,
      inserted,
      duplicates,
      categorized: result.categorizedCount,
      duration: `${duration}ms`,
    });

    return res.json({
      success: true,
      bank: result.bank,
      totalRows: result.totalRows,
      transactions: result.transactions.length,
      inserted,
      duplicates,
      skipped: result.skippedRows,
      categorized: result.categorizedCount,
      importId,
      duration: `${duration}ms`,
      message: `Importiert ${inserted} Transaktionen von ${result.bank}. ${result.categorizedCount} wurden automatisch kategorisiert.`,
    });
  } catch (err: any) {
    console.error('[import/stream] error', {
      error: err?.message,
      stack: err?.stack,
    });

    if (err?.message?.includes('Unknown bank format')) {
      return res.status(400).json({
        code: 'UNKNOWN_FORMAT',
        message: err.message,
      });
    }

    return res.status(500).json({
      code: 'IMPORT_FAILED',
      message: err?.message || 'Import fehlgeschlagen',
    });
  }
});

importRouter.get('/history', (req, res) => {
  const db = (req.app as any)?.locals?.db ?? defaultDb;
  const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const limit = Number.parseInt(typeof limitRaw === 'string' ? limitRaw : '', 10);
  const size = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 10;
  const history = getRecentImports(size, db);
  return res.json({ history });
});

