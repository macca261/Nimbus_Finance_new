import { Router } from 'express';
import BetterSqlite3 from 'better-sqlite3';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import { applyCategoryFeedback, getTransactionById, insertOverrideRule, getAllOverrideRules, deleteOverrideRule, applyOverrideRuleToExistingTransactions } from '../db';
import { isValidCategory } from '../config/categories';
import { buildCategorizationExplanation } from '../categorization/explanation';
import crypto from 'node:crypto';

const filePath = process.env.NIMBUS_DB_PATH || process.env.DB_FILE || 'nimbus.db';
const fallbackDb = new BetterSqlite3(filePath);
export const transactionsRouter = Router();

function getConnection(req: any): BetterSqliteDatabase {
  return ((req.app as any)?.locals?.db ?? null) || fallbackDb;
}

type QueryNumber = number | null;

type QueryRow = {
  id: number;
  bookingDate: string | null;
  valueDate: string | null;
  amountCents: number;
  amount: number;
  currency: string | null;
  direction: string | null;
  counterpart: string | null;
  counterpartyIban: string | null;
  purpose: string | null;
  accountIban: string | null;
  bankProfile: string | null;
  category: string | null;
  categorySource: string | null;
  categoryConfidence: number | null;
  categoryExplanation: string | null;
  categoryRuleId: string | null;
  payee: string | null;
  memo: string | null;
  source: string | null;
  sourceProfile: string | null;
  transferLinkId: string | null;
  isTransfer: number | null;
  externalId: string | null;
  referenceId: string | null;
  isRefund: number | null;
  isRefunded: number | null;
  refundGroupId: string | null;
  isInternalTransfer: number | null;
  internalTransferDirection: string | null;
  internalTransferKind: string | null;
  internalTransferGroupId: string | null;
  isReimbursement: number | null;
  reimbursementRole: string | null;
  reimbursementGroupId: string | null;
  reimbursementShareRatio: number | null;
  bankReferenceId: string | null;
  isPassThrough: number | null;
  passThroughGroupId: string | null;
  raw: string | null;
};

function parseAmount(value: unknown): QueryNumber {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed)) return null;
  return Math.round(parsed * 100);
}

transactionsRouter.get('/', (req, res) => {
  try {
    const db = getConnection(req);
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 500);
    const offset = Math.max(Number.parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : '';
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const minAmountCents = parseAmount(req.query.minAmount);
    const maxAmountCents = parseAmount(req.query.maxAmount);

    const clauses: string[] = [];
    const params: any[] = [];

    if (category) {
      clauses.push('category = ?');
      params.push(category);
    }
    if (startDate) {
      clauses.push('bookingDate >= ?');
      params.push(startDate);
    }
    if (endDate) {
      clauses.push('bookingDate <= ?');
      params.push(endDate);
    }
    if (minAmountCents !== null) {
      clauses.push('amountCents >= ?');
      params.push(minAmountCents);
    }
    if (maxAmountCents !== null) {
      clauses.push('amountCents <= ?');
      params.push(maxAmountCents);
    }
    if (search) {
      const like = `%${search.replace(/\s+/g, '%')}%`;
      clauses.push('(purpose LIKE ? OR counterpartName LIKE ?)');
      params.push(like, like);
    }

    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const rows = db
      .prepare(
        `
        SELECT
          id,
          bookingDate AS bookingDate,
          valueDate,
          amountCents,
          amountCents / 100.0 AS amount,
          currency,
          direction,
          counterpartName AS counterpart,
          counterpartyIban,
          purpose,
          payee,
          memo,
          accountIban AS accountIban,
          bankProfile,
          category,
          category_source AS categorySource,
          category_confidence AS categoryConfidence,
          category_explanation AS categoryExplanation,
          category_rule_id AS categoryRuleId,
          source,
          sourceProfile,
          transferLinkId,
          isTransfer,
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
        ${whereSql}
        ORDER BY datetime(bookingDate) DESC, id DESC
        LIMIT ? OFFSET ?
      `,
      )
      .all(...params, limit, offset) as QueryRow[];

    const normalized = rows.map(row => {
      let parsedRaw: Record<string, unknown> | undefined;
      if (row.raw) {
        try {
          parsedRaw = typeof row.raw === 'string' ? JSON.parse(row.raw) : undefined;
        } catch {
          parsedRaw = undefined;
        }
      }
      const metadata =
        parsedRaw && typeof parsedRaw.metadata === 'object' ? (parsedRaw.metadata as Record<string, unknown>) : undefined;
      const payee = row.payee ?? row.counterpart ?? null;
      const memo = row.memo ?? row.purpose ?? null;
      const tx: any = {
        id: row.id,
        bookingDate: row.bookingDate,
        bookedAt: row.bookingDate,
        valueDate: row.valueDate,
        amountCents: row.amountCents,
        amount: row.amount,
        currency: row.currency,
        direction: row.direction,
        payee,
        counterpart: row.counterpart,
        counterpartyIban: row.counterpartyIban,
        purpose: row.purpose,
        memo,
        accountIban: row.accountIban,
        bankProfile: row.bankProfile,
        category: row.category,
        categorySource: row.categorySource,
        categoryConfidence: row.categoryConfidence,
        categoryExplanation: row.categoryExplanation,
        categoryRuleId: row.categoryRuleId,
        source: row.source,
        sourceProfile: row.sourceProfile,
        transferLinkId: row.transferLinkId,
        isInternalTransfer: Boolean(row.isInternalTransfer) ||
          Boolean(
            row.transferLinkId ||
              row.isTransfer ||
              row.category === 'transfer_internal' ||
              (row.category ? row.category.startsWith('internal') : false),
          ),
        rawText: memo,
        externalId: row.externalId,
        referenceId: row.referenceId,
        metadata,
        isRefund: Boolean(row.isRefund),
        isRefunded: Boolean(row.isRefunded),
        refundGroupId: row.refundGroupId ?? null,
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
      };
      
      // Add categorization explanation
      const explanation = buildCategorizationExplanation(tx);
      tx.categorizationReasonCode = explanation.code;
      tx.categorizationReasonText = explanation.text;
      
      return tx;
    });

    const totalRow = db
      .prepare(`SELECT COUNT(1) AS count FROM transactions ${whereSql}`)
      .get(...params) as { count: number };

    return res.json({ ok: true, total: totalRow?.count ?? 0, transactions: normalized });
  } catch (e: any) {
    console.error('GET /api/transactions failed', e);
    return res.status(500).json({ error: 'Failed to load transactions' });
  }
});

transactionsRouter.get('/recent', (req, res) => {
  try {
    const limit = Number(req.query.limit) || 200;
    const db = getConnection(req);
    const rows = db
      .prepare(
        `
        SELECT
          id,
          bookingDate AS bookingDate,
          valueDate,
          amountCents,
          amountCents / 100.0 AS amount,
          currency,
          direction,
          counterpartName AS counterpart,
          counterpartyIban,
          purpose,
          payee,
          memo,
          accountIban AS accountIban,
          bankProfile,
          category,
          category_source as categorySource,
          category_confidence as categoryConfidence,
          category_explanation as categoryExplanation,
          category_rule_id as categoryRuleId,
          source,
          sourceProfile,
          transferLinkId,
          isTransfer,
          externalId,
          referenceId,
          isPassThrough,
          passThroughGroupId,
          raw
        FROM transactions
        ORDER BY datetime(bookingDate) DESC, id DESC
        LIMIT ?
      `,
      )
      .all(limit) as QueryRow[];

    const normalized = rows.map(row => {
      let parsedRaw: Record<string, unknown> | undefined;
      if (row.raw) {
        try {
          parsedRaw = typeof row.raw === 'string' ? JSON.parse(row.raw) : undefined;
        } catch {
          parsedRaw = undefined;
        }
      }
      const metadata =
        parsedRaw && typeof parsedRaw.metadata === 'object' ? (parsedRaw.metadata as Record<string, unknown>) : undefined;
      const payee = row.payee ?? row.counterpart ?? null;
      const memo = row.memo ?? row.purpose ?? null;
      const tx: any = {
        id: row.id,
        bookingDate: row.bookingDate,
        bookedAt: row.bookingDate,
        valueDate: row.valueDate,
        amountCents: row.amountCents,
        amount: row.amount,
        currency: row.currency,
        direction: row.direction,
        payee,
        counterpart: row.counterpart,
        counterpartyIban: row.counterpartyIban,
        purpose: row.purpose,
        memo,
        accountIban: row.accountIban,
        bankProfile: row.bankProfile,
        category: row.category,
        categorySource: row.categorySource,
        categoryConfidence: row.categoryConfidence,
        categoryExplanation: row.categoryExplanation,
        categoryRuleId: row.categoryRuleId,
        source: row.source,
        sourceProfile: row.sourceProfile,
        transferLinkId: row.transferLinkId,
        isInternalTransfer: Boolean(row.isInternalTransfer) ||
          Boolean(
            row.transferLinkId ||
              row.isTransfer ||
              row.category === 'transfer_internal' ||
              (row.category ? row.category.startsWith('internal') : false),
          ),
        internalTransferDirection: row.internalTransferDirection ?? null,
        internalTransferKind: row.internalTransferKind ?? null,
        internalTransferGroupId: row.internalTransferGroupId ?? null,
        rawText: memo,
        externalId: row.externalId,
        referenceId: row.referenceId,
        metadata,
        isRefund: Boolean(row.isRefund),
        isRefunded: Boolean(row.isRefunded),
        refundGroupId: row.refundGroupId ?? null,
        isReimbursement: Boolean(row.isReimbursement),
        reimbursementRole: row.reimbursementRole ?? null,
        reimbursementGroupId: row.reimbursementGroupId ?? null,
        reimbursementShareRatio: row.reimbursementShareRatio ?? null,
        bankReferenceId: row.bankReferenceId ?? null,
        isPassThrough: Boolean(row.isPassThrough),
        passThroughGroupId: row.passThroughGroupId ?? null,
      };
      
      // Add categorization explanation
      const explanation = buildCategorizationExplanation(tx);
      tx.categorizationReasonCode = explanation.code;
      tx.categorizationReasonText = explanation.text;
      
      return tx;
    });

    return res.json({ ok: true, count: normalized.length, transactions: normalized });
  } catch (e: any) {
    console.error('GET /api/transactions/recent failed', e);
    return res.status(500).json({ error: 'Failed to load transactions' });
  }
});

// Pass-through pairing endpoints
transactionsRouter.post('/pass-through', (req, res) => {
  try {
    const db = getConnection(req);
    const { transactionIds } = req.body || {};
    if (!Array.isArray(transactionIds) || transactionIds.length !== 2) {
      return res.status(400).json({ ok: false, error: 'Provide exactly two transactionIds' });
    }
    const [a, b] = transactionIds.map((v: any) => Number(v)).sort((x: number, y: number) => x - y);
    const rows = db.prepare(`SELECT id, amountCents FROM transactions WHERE id IN (?, ?)`).all(a, b) as Array<{ id: number; amountCents: number }>;
    if (!rows || rows.length !== 2) return res.status(404).json({ ok: false, error: 'Transactions not found' });
    const sumCents = (rows[0].amountCents ?? 0) + (rows[1].amountCents ?? 0);
    if (Math.abs(sumCents) > 100) {
      return res.status(400).json({ ok: false, error: 'Pass-through requires amounts to net to ~0 (±1€)' });
    }
    const groupId = `pt:${a}:${b}`;
    db.prepare(`UPDATE transactions SET isPassThrough = 1, passThroughGroupId = ? WHERE id IN (?, ?)`).run(groupId, a, b);
    return res.json({ ok: true, passThroughGroupId: groupId, transactionIds: [a, b], netCents: sumCents });
  } catch (e: any) {
    console.error('[pass-through] error', e);
    return res.status(500).json({ ok: false, error: 'Failed to set pass-through' });
  }
});

transactionsRouter.post('/pass-through/remove', (req, res) => {
  try {
    const db = getConnection(req);
    const { transactionIds } = req.body || {};
    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return res.status(400).json({ ok: false, error: 'Provide transactionIds to clear' });
    }
    const placeholders = transactionIds.map(() => '?').join(',');
    db.prepare(`UPDATE transactions SET isPassThrough = 0, passThroughGroupId = NULL WHERE id IN (${placeholders})`).run(...transactionIds);
    return res.json({ ok: true, transactionIds });
  } catch (e: any) {
    console.error('[pass-through/remove] error', e);
    return res.status(500).json({ ok: false, error: 'Failed to clear pass-through' });
  }
});

transactionsRouter.post('/:id/category', (req, res) => {
  try {
    const id = Number.parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid transaction id' });
    }
    const { category } = req.body ?? {};
    if (typeof category !== 'string' || !isValidCategory(category)) {
      return res.status(400).json({ error: 'Invalid category id' });
    }
    const db = getConnection(req);
    const updated = applyCategoryFeedback({ txId: id, newCategory: category }, db);
    if (!updated) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    return res.json({
      ok: true,
      transaction: {
        id: updated.id,
        bookingDate: updated.bookingDate,
        valueDate: updated.valueDate,
        amountCents: updated.amountCents,
        currency: updated.currency,
        direction: updated.direction ?? (updated.amountCents >= 0 ? 'in' : 'out'),
        counterparty: updated.counterpartName ?? null,
        rawText: updated.purpose ?? null,
        accountIban: updated.accountIban ?? null,
        bankProfile: updated.bankProfile ?? null,
        category: category,
        categorySource: 'feedback',
        categoryConfidence: 1,
        categoryExplanation: 'User override',
        categoryRuleId: null,
      },
    });
  } catch (error) {
    console.error('POST /api/transactions/:id/category failed', error);
    return res.status(500).json({ error: 'Failed to update category' });
  }
});

transactionsRouter.post('/:id/promote-rule', (req, res) => {
  try {
    const id = Number.parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid transaction id' });
    }
    const db = getConnection(req);
    
    // Get transaction with additional fields needed for rule creation
    const txRow = db
      .prepare(`
        SELECT id, category, payee, counterpartName, memo, purpose,
               isRefund, isRefunded, isInternalTransfer, isReimbursement
        FROM transactions
        WHERE id = ?
      `)
      .get(id) as {
        id: number;
        category: string | null;
        payee: string | null;
        counterpartName: string | null;
        memo: string | null;
        purpose: string | null;
        isRefund: number | null;
        isRefunded: number | null;
        isInternalTransfer: number | null;
        isReimbursement: number | null;
      } | undefined;

    if (!txRow) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Validation: cannot promote if category is 'other' or 'other_review'
    if (!txRow.category || txRow.category === 'other' || txRow.category === 'other_review') {
      return res.status(400).json({ 
        error: 'Cannot create rule from uncategorized transaction. Please assign a category first.' 
      });
    }

    // Validation: cannot promote refunds, internal transfers, or reimbursements
    if (txRow.isRefund || txRow.isRefunded || txRow.isInternalTransfer || txRow.isReimbursement) {
      return res.status(400).json({ 
        error: 'Cannot create rule from refund, internal transfer, or reimbursement transaction.' 
      });
    }

    // Determine merchant pattern
    // Prefer payee or counterpartName, fall back to memo or purpose
    let merchantPattern: string | null = null;
    let patternType: 'payee' | 'memo' = 'payee';

    if (txRow.payee && txRow.payee.trim()) {
      merchantPattern = txRow.payee.trim();
      patternType = 'payee';
    } else if (txRow.counterpartName && txRow.counterpartName.trim()) {
      merchantPattern = txRow.counterpartName.trim();
      patternType = 'payee';
    } else if (txRow.memo && txRow.memo.trim()) {
      merchantPattern = txRow.memo.trim();
      patternType = 'memo';
    } else if (txRow.purpose && txRow.purpose.trim()) {
      merchantPattern = txRow.purpose.trim();
      patternType = 'memo';
    }

    if (!merchantPattern || merchantPattern.length < 2) {
      return res.status(400).json({ 
        error: 'Transaction does not have a merchant name or description suitable for rule creation.' 
      });
    }

    // Validate category
    if (!isValidCategory(txRow.category)) {
      return res.status(400).json({ error: 'Invalid category id' });
    }

    // Create the user override rule
    const ruleId = `user_rule_${crypto.randomUUID()}`;
    const rule = insertOverrideRule(
      {
        id: ruleId,
        patternType,
        pattern: merchantPattern,
        categoryId: txRow.category,
        applyToPast: false, // v1: only apply to future transactions
      },
      db
    );

    return res.json({
      ok: true,
      ruleId: rule.id,
      pattern: rule.pattern,
      patternType: rule.patternType,
      categoryId: rule.categoryId,
      message: `Rule created: future transactions with ${patternType} containing "${rule.pattern}" will be categorized as "${rule.categoryId}"`,
    });
  } catch (error: any) {
    console.error('POST /api/transactions/:id/promote-rule failed', error);
    return res.status(500).json({ error: error?.message || 'Failed to create rule' });
  }
});

transactionsRouter.get('/user-rules', (req, res) => {
  try {
    const db = getConnection(req);
    const rules = getAllOverrideRules(db);
    
    const apiRules = rules.map(rule => ({
      id: rule.id,
      pattern: rule.pattern,
      patternType: rule.patternType,
      categoryId: rule.categoryId,
      createdAt: rule.createdAt,
    }));

    return res.json({ rules: apiRules });
  } catch (error: any) {
    console.error('GET /api/transactions/user-rules failed', error);
    return res.status(500).json({ error: error?.message || 'Failed to load rules' });
  }
});

transactionsRouter.delete('/user-rules/:id', (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Rule id is required' });
    }

    const db = getConnection(req);
    const deleted = deleteOverrideRule(id, db);

    if (!deleted) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    return res.json({ ok: true, message: 'Rule deleted' });
  } catch (error: any) {
    console.error('DELETE /api/transactions/user-rules/:id failed', error);
    return res.status(500).json({ error: error?.message || 'Failed to delete rule' });
  }
});

transactionsRouter.post('/user-rules/:id/apply', (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ ok: false, error: 'Rule id is required' });
    }

    const db = getConnection(req);
    
    // Verify the rule exists
    const rules = getAllOverrideRules(db);
    const rule = rules.find(r => r.id === id);
    
    if (!rule) {
      return res.status(404).json({ ok: false, error: 'Rule not found' });
    }

    // Apply the rule to existing transactions
    const result = applyOverrideRuleToExistingTransactions(id, db);

    return res.json({
      ok: true,
      ruleId: id,
      updatedCount: result.updatedCount,
    });
  } catch (error: any) {
    console.error('[user-rules/apply] failed', error);
    return res.status(500).json({ ok: false, error: 'Failed to apply rule to existing transactions' });
  }
});

