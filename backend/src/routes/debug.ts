import { Router } from 'express';
import BetterSqlite3 from 'better-sqlite3';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import { buildCategorizationExplanation } from '../categorization/explanation';
import { categorizeTransaction, mapNimbusCategoryToLegacy } from '../categorization';
import type { ParsedRow } from '../parsing/types';

const filePath = process.env.NIMBUS_DB_PATH || process.env.DB_FILE || 'nimbus.db';
const fallbackDb = new BetterSqlite3(filePath);

const debugRouter = Router();

function getConnection(req: any): BetterSqliteDatabase {
  return ((req.app as any)?.locals?.db ?? null) || fallbackDb;
}

debugRouter.get('/transaction/:id', (req, res) => {
  try {
    const db = getConnection(req);
    const id = Number.parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'invalid_id' });
    }

    const row = db
      .prepare(
        `
        SELECT
          id,
          publicId,
          bookingDate,
          valueDate,
          amountCents,
          currency,
          direction,
          purpose,
          counterpartName,
          counterpartyIban,
          accountIban,
          bankProfile,
          category,
          category_source AS categorySource,
          category_confidence AS categoryConfidence,
          category_explanation AS categoryExplanation,
          category_rule_id AS categoryRuleId,
          source,
          sourceProfile,
          payee,
          memo,
          isTransfer,
          transferLinkId,
          externalId,
          referenceId,
          isRefund,
          isRefunded,
          refundGroupId,
          isInternalTransfer,
          internalTransferDirection,
          internalTransferKind,
          internalTransferGroupId,
          isReimbursement,
          reimbursementRole,
          reimbursementGroupId,
          reimbursementShareRatio,
          bankReferenceId,
          isPassThrough,
          passThroughGroupId,
          raw
        FROM transactions
        WHERE id = ?
      `,
      )
      .get(id) as any;

    if (!row) {
      return res.status(404).json({ error: 'not_found' });
    }

    // Parse raw JSON payload if present
    let parsedRaw: Record<string, unknown> | undefined;
    if (row.raw) {
      try {
        parsedRaw = typeof row.raw === 'string' ? JSON.parse(row.raw) : undefined;
      } catch {
        parsedRaw = undefined;
      }
    }

    const metadata =
      parsedRaw && typeof parsedRaw.metadata === 'object'
        ? (parsedRaw.metadata as Record<string, unknown>)
        : undefined;

    const payee = row.payee ?? row.counterpartName ?? null;
    const memo = row.memo ?? row.purpose ?? null;

    // Normalized transaction shape used for explanation + frontend
    const normalized: any = {
      id: row.id,
      publicId: row.publicId ?? null,
      bookingDate: row.bookingDate,
      valueDate: row.valueDate,
      amountCents: row.amountCents,
      amount: typeof row.amountCents === 'number' ? row.amountCents / 100 : null,
      currency: row.currency,
      direction: row.direction,
      payee,
      counterpart: row.counterpartName ?? null,
      counterpartyIban: row.counterpartyIban ?? null,
      purpose: row.purpose,
      memo,
      accountIban: row.accountIban ?? null,
      bankProfile: row.bankProfile ?? null,
      category: row.category ?? null,
      categorySource: row.categorySource ?? null,
      categoryConfidence: row.categoryConfidence ?? null,
      categoryExplanation: row.categoryExplanation ?? null,
      categoryRuleId: row.categoryRuleId ?? null,
      source: row.source ?? null,
      sourceProfile: row.sourceProfile ?? null,
      transferLinkId: row.transferLinkId ?? null,
      isTransfer: Boolean(row.isTransfer),
      externalId: row.externalId ?? null,
      referenceId: row.referenceId ?? null,
      isRefund: Boolean(row.isRefund),
      isRefunded: Boolean(row.isRefunded),
      refundGroupId: row.refundGroupId ?? null,
      isInternalTransfer: Boolean(row.isInternalTransfer),
      internalTransferDirection: row.internalTransferDirection ?? null,
      internalTransferKind: row.internalTransferKind ?? null,
      internalTransferGroupId: row.internalTransferGroupId ?? null,
      isReimbursement: Boolean(row.isReimbursement),
      reimbursementRole: row.reimbursementRole ?? null,
      reimbursementGroupId: row.reimbursementGroupId ?? null,
      reimbursementShareRatio: row.reimbursementShareRatio ?? null,
      bankReferenceId: row.bankReferenceId ?? null,
      isPassThrough: Boolean(row.isPassThrough),
      passThroughGroupId: row.passThroughGroupId ?? null,
      rawText: memo ?? row.purpose ?? '',
      metadata,
    };

    const explanation = buildCategorizationExplanation(normalized);
    normalized.categorizationReasonCode = explanation.code;
    normalized.categorizationReasonText = explanation.text;

    // Reconstruct ParsedRow similar to categorize() helper for engine debugging
    const amountCents: number = row.amountCents ?? 0;
    const direction: ParsedRow['direction'] = amountCents >= 0 ? 'in' : 'out';
    const parsedRow: ParsedRow = {
      bookingDate: row.bookingDate ?? '1970-01-01',
      valutaDate: row.valueDate ?? null,
      amountCents,
      currency: (row.currency ?? 'EUR') as string,
      direction,
      accountId: (parsedRaw?.accountId as string) ?? 'debug:row',
      accountIban: row.accountIban ?? null,
      counterparty: row.counterpartName ?? null,
      counterpartyIban: row.counterpartyIban ?? null,
      mcc: null,
      reference: row.referenceId ?? null,
      rawText: normalized.rawText,
      raw: parsedRaw ?? {},
      // Optional categorization fields
      category: row.category ?? undefined,
      categoryConfidence: row.categoryConfidence ?? undefined,
      categorySource: row.categorySource ?? undefined,
      categorySystem: 'nimbus-v1',
      normalizedText: undefined,
    };

    const engineResult = categorizeTransaction(parsedRow);
    const legacyCategoryId = mapNimbusCategoryToLegacy(engineResult.category);

    // Derive txKind from amount sign + flags (read-only helper)
    let txKind: string = 'unknown';
    if (normalized.isRefund || normalized.isRefunded) {
      txKind = 'refund';
    } else if (normalized.isInternalTransfer) {
      txKind = 'transfer_internal';
    } else if (normalized.isReimbursement) {
      txKind = 'reimbursement';
    } else if (amountCents > 0) {
      const upperText = (normalized.rawText || '').toUpperCase();
      if (upperText.includes('GEHALT') || upperText.includes('LOHN') || upperText.includes('SALARY')) {
        txKind = 'income_salary';
      } else {
        txKind = 'income';
      }
    } else if (amountCents < 0) {
      txKind = 'expense';
    }

    return res.json({
      raw: {
        id: row.id,
        publicId: row.publicId ?? null,
        bookingDate: row.bookingDate,
        valueDate: row.valueDate,
        amountCents: row.amountCents,
        currency: row.currency,
        purpose: row.purpose,
        counterpartName: row.counterpartName,
        accountIban: row.accountIban,
        bankProfile: row.bankProfile,
        category: row.category,
        categorySource: row.categorySource,
        categoryConfidence: row.categoryConfidence,
        categoryRuleId: row.categoryRuleId,
        source: row.source,
        sourceProfile: row.sourceProfile,
        isRefund: Boolean(row.isRefund),
        isRefunded: Boolean(row.isRefunded),
        isInternalTransfer: Boolean(row.isInternalTransfer),
        internalTransferKind: row.internalTransferKind,
        isPassThrough: Boolean(row.isPassThrough),
        isReimbursement: Boolean(row.isReimbursement),
        reimbursementRole: row.reimbursementRole,
      },
      normalized,
      engine: {
        nimbusCategory: engineResult.category,
        categoryId: legacyCategoryId,
        categorySource: engineResult.categorySource ?? null,
        categoryRuleId: engineResult.categoryExplanation?.ruleId ?? null,
        txKind,
      },
    });
  } catch (e: any) {
    // Debug endpoint must not mutate anything; just fail safely
    console.error('[debug] /api/debug/transaction failed', e);
    return res.status(500).json({ error: 'debug_failed' });
  }
});

export default debugRouter;


