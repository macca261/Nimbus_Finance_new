import { Router } from 'express';
import BetterSqlite3 from 'better-sqlite3';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import { applyCategoryFeedback } from '../db';
import { isValidCategory } from '../config/categories';

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
      return {
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
        isInternalTransfer: Boolean(
          row.transferLinkId ||
            row.isTransfer ||
            row.category === 'transfer_internal' ||
            (row.category ? row.category.startsWith('internal') : false),
        ),
        rawText: memo,
        externalId: row.externalId,
        referenceId: row.referenceId,
        metadata,
      };
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
      return {
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
        isInternalTransfer: Boolean(
          row.transferLinkId ||
            row.isTransfer ||
            row.category === 'transfer_internal' ||
            (row.category ? row.category.startsWith('internal') : false),
        ),
        rawText: memo,
        externalId: row.externalId,
        referenceId: row.referenceId,
        metadata,
      };
    });

    return res.json({ ok: true, count: normalized.length, transactions: normalized });
  } catch (e: any) {
    console.error('GET /api/transactions/recent failed', e);
    return res.status(500).json({ error: 'Failed to load transactions' });
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

