import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { parseBankCsv, ParseBankCsvError } from '../parser/parseBankCsv';
import { PayPalParseError } from '../parser/paypal';
import { recordImport, getAllOverrideRules, getRecentImports, db as defaultDb } from '../db';
import { persistTransactions } from '../services/importCsv';
import { categorize } from '../categorization';
import { toNormalizedTransaction } from '../services/normalizeTransaction';
import { findMatchingOverride } from '../overrides/userOverrides';
import type { Transaction } from '../types/core';
import { runTransferMatching } from '../services/transferMatching';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

export const importRouter = Router();

const handleImport: RequestHandler = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'Keine Datei übermittelt.' });
    }

    const hint = typeof req.query.bank === 'string' ? req.query.bank : undefined;
    const result = await parseBankCsv(req.file.buffer, hint);

    if (!result.rows.length) {
      return res.status(400).json({
        error: 'Unsupported or undetected bank',
        hints: [
          'Keine gültigen Umsätze erkannt – Tabelle enthält keine Buchungszeilen.',
          'Prüfe Kopfzeile: enthält sie "Buchungstag" und "Umsatz in EUR"?',
          'Prüfe Trennzeichen (; vs ,) und Dezimalformat (1.234,56).',
          'CSV als UTF-8 oder ISO-8859-1 (Latin-1) speichern.',
        ],
        profileId: result.profileId,
        confidence: result.confidence,
        warnings: result.warnings,
        candidates: result.candidates,
      });
    }

    const importFile = req.file?.originalname ?? 'upload.csv';

    const db = (req.app as any)?.locals?.db ?? defaultDb;
    const overrideRules = getAllOverrideRules(db);

    const normalized = result.rows.map((row, index) => {
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
      const category = categorize({
        text: combinedText,
        amount: row.amountCents / 100,
        amountCents: row.amountCents,
        iban: row.accountIban ?? null,
        counterpart: row.counterparty ?? null,
        payee: row.counterparty ?? null,
        memo: row.rawText,
        source,
        transaction: txCandidate,
        overrideMatch: overrideMatch ? { ruleId: overrideMatch.rule.id, categoryId: overrideMatch.categoryId } : undefined,
      });
      return toNormalizedTransaction(row, result.profileId, category);
    });

    const diagnostics = persistTransactions({
      profileId: result.profileId,
      confidence: result.confidence,
      filename: importFile,
      transactions: normalized,
      db,
    });

    runTransferMatching(db);

    console.log(
      '[import] profile=%s confidence=%d rows=%d inserted=%d dup=%d skipped=%d file=%s reasons=%s',
      diagnostics.profileId,
      diagnostics.confidence,
      diagnostics.rowCount,
      diagnostics.inserted,
      diagnostics.duplicates,
      diagnostics.skipped,
      importFile,
      diagnostics.reasons.join(' | '),
    );

    if (diagnostics.inserted === 0) {
      return res.status(400).json({
        error: 'Keine gültigen Umsätze importiert.',
        profileId: diagnostics.profileId,
        confidence: diagnostics.confidence,
        rowCount: diagnostics.rowCount,
        reasons: diagnostics.reasons,
        warnings: result.warnings ?? [],
        candidates: result.candidates,
      });
    }

    recordImport(
      {
        profileId: diagnostics.profileId,
        fileName: importFile,
        confidence: diagnostics.confidence,
        transactionCount: diagnostics.rowCount,
        warnings: result.warnings ?? [],
      },
      db,
    );

    return res.json({
      ok: true,
      profileId: diagnostics.profileId,
      confidence: diagnostics.confidence,
      fileName: importFile,
      transactionCount: diagnostics.rowCount,
      insertedCount: diagnostics.inserted,
      duplicateCount: diagnostics.duplicates,
      skippedCount: diagnostics.skipped,
      reasons: diagnostics.reasons,
      warnings: result.warnings,
      candidates: result.candidates,
      openingBalance: result.openingBalance,
      closingBalance: result.closingBalance,
    });
  } catch (error) {
    if (error instanceof PayPalParseError) {
      // eslint-disable-next-line no-console
      console.error('[import] PayPalParseError', error.message, error.details);
      return res.status(422).json({
        code: 'PAYPAL_PARSE_ERROR',
        message: error.message,
        details: error.details ?? null,
      });
    }
    if (error instanceof ParseBankCsvError) {
      return res.status(400).json({
        error: error.message,
        hints: error.hints.length ? error.hints : undefined,
        candidates: error.candidates.length ? error.candidates : undefined,
        warnings: [],
      });
    }
    // eslint-disable-next-line no-console
    console.error('[import] Unhandled import error', error);
    return res.status(500).json({ error: 'Unbekannter Importfehler' });
  }
};

importRouter.post('/', upload.single('file'), handleImport);

importRouter.get('/history', (req, res) => {
  const db = (req.app as any)?.locals?.db ?? defaultDb;
  const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const limit = Number.parseInt(typeof limitRaw === 'string' ? limitRaw : '', 10);
  const size = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 10;
  const history = getRecentImports(size, db);
  return res.json({ history });
});

