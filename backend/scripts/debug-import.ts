import fs from 'node:fs';
import path from 'node:path';
import { db, initDb, getAllOverrideRules } from '../src/db';
import { parseBankCsv, ParseBankCsvError } from '../src/parser/parseBankCsv';
import { PayPalParseError } from '../src/parser/paypal';
import { persistTransactions } from '../src/services/importCsv';
import { categorize } from '../src/categorization';
import { toNormalizedTransaction } from '../src/services/normalizeTransaction';
import { findMatchingOverride } from '../src/overrides/userOverrides';
import type { Transaction } from '../src/types/core';

async function main(): Promise<void> {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Usage: npm -w backend run ts-node scripts/debug-import.ts <path-to-csv>');
    process.exit(1);
  }

  const absPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absPath)) {
    console.error('[debug-import] file not found:', absPath);
    process.exit(1);
  }

  const buffer = fs.readFileSync(absPath);
  const fileName = path.basename(absPath);

  console.log('[debug-import] path =', absPath);
  console.log('[debug-import] size bytes =', buffer.length);
  console.log('[debug-import] fileName =', fileName);

  // Initialize DB (in-memory for testing)
  initDb(db);

  try {
    // Step 1: Parse
    let result;
    try {
      result = await parseBankCsv(buffer);
      console.log('[debug-import] parsed', {
        profileId: result.profileId,
        confidence: result.confidence,
        rowCount: result.rows.length,
        warnings: result.warnings?.length ?? 0,
      });
    } catch (parseError) {
      console.error('[debug-import] parse error');
      if (parseError instanceof PayPalParseError) {
        console.error('  code: PAYPAL_PARSE_ERROR');
        console.error('  message:', parseError.message);
        console.error('  details:', parseError.details ?? null);
        process.exit(1);
      }
      if (parseError instanceof ParseBankCsvError) {
        console.error('  code: BANK_PARSE_ERROR');
        console.error('  message:', parseError.message);
        console.error('  hints:', parseError.hints);
        console.error('  candidates:', parseError.candidates);
        process.exit(1);
      }
      throw parseError;
    }

    if (!result.rows.length) {
      console.error('[debug-import] IMPORT_EMPTY: no rows found');
      console.log(JSON.stringify({
        code: 'IMPORT_EMPTY',
        profileId: result.profileId,
        confidence: result.confidence,
        warnings: result.warnings ?? [],
      }, null, 2));
      process.exit(1);
    }

    // Step 2: Normalize and categorize (same as route handler)
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

    // Step 3: Persist
    let diagnostics;
    try {
      diagnostics = persistTransactions({
        profileId: result.profileId,
        confidence: result.confidence,
        filename: fileName,
        transactions: normalized,
        db,
        batchId: 'debug-cli',
      });
      console.log('[debug-import] persisted', {
        inserted: diagnostics.inserted,
        duplicates: diagnostics.duplicates,
        skipped: diagnostics.skipped,
        reasons: diagnostics.reasons,
      });
    } catch (persistError) {
      console.error('[debug-import] persist error');
      if (persistError instanceof Error && persistError.message.includes('duplicate')) {
        console.error('  code: IMPORT_EMPTY');
        console.error('  reason: all duplicates');
        process.exit(1);
      }
      throw persistError;
    }

    if (diagnostics.inserted === 0) {
      console.error('[debug-import] IMPORT_EMPTY: no transactions inserted');
      console.log(JSON.stringify({
        code: 'IMPORT_EMPTY',
        profileId: diagnostics.profileId,
        confidence: diagnostics.confidence,
        rowCount: diagnostics.rowCount,
        reasons: diagnostics.reasons,
      }, null, 2));
      process.exit(1);
    }

    // Success summary
    console.log('\n[debug-import] SUCCESS');
    console.log(JSON.stringify({
      profileId: diagnostics.profileId,
      confidence: diagnostics.confidence,
      rowCount: diagnostics.rowCount,
      inserted: diagnostics.inserted,
      duplicates: diagnostics.duplicates,
      skipped: diagnostics.skipped,
      warnings: result.warnings?.length ?? 0,
      reasons: diagnostics.reasons,
    }, null, 2));

  } catch (error) {
    console.error('[debug-import] unknown error');
    const err = error as { name?: string; message?: string; stack?: string };
    console.error('  name:', err?.name ?? 'UnknownError');
    console.error('  message:', err?.message ?? String(error));
    if (err?.stack) {
      const stackLines = err.stack.split('\n');
      console.error('  stack (first 10 lines):');
      stackLines.slice(0, 10).forEach(line => console.error('   ', line));
    }
    console.error('\n  code: IMPORT_FAILED');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('[debug-import] fatal', error);
  process.exit(1);
});

