import crypto from 'node:crypto';
import type { CategoryId } from '../types/category';
import type { Database } from '../db';
import {
  db as defaultDb,
  getTransactionByPublicId,
  insertOverrideRule,
  applyOverrideRuleToTransactions,
} from '../db';
import type { UserOverrideRule } from '../types/core';

export interface CreateOverridePayload {
  txId: string;
  categoryId: CategoryId;
  scope?: 'payee' | 'memo' | 'iban';
  applyToPast?: boolean;
}

export function createOverrideRule(payload: CreateOverridePayload, conn: Database = defaultDb): UserOverrideRule {
  const transaction = getTransactionByPublicId(payload.txId, conn);
  if (!transaction) {
    throw new Error(`Transaction ${payload.txId} not found`);
  }

  const scope = payload.scope ?? 'payee';
  const pattern = derivePattern(scope, transaction);
  if (!pattern) {
    throw new Error(`Cannot derive pattern from transaction for scope "${scope}"`);
  }

  const applyToPast = Boolean(payload.applyToPast);
  const rule = insertOverrideRule(
    {
      id: crypto.randomUUID(),
      patternType: scope,
      pattern,
      categoryId: payload.categoryId,
      applyToPast,
    },
    conn,
  );

  if (applyToPast) {
    applyOverrideRuleToTransactions(rule, conn);
  }

  return rule;
}

function derivePattern(scope: 'payee' | 'memo' | 'iban', tx: ReturnType<typeof getTransactionByPublicId>): string | null {
  if (!tx) return null;
  switch (scope) {
    case 'payee':
      return (tx.payee ?? tx.counterparty ?? '').trim().toLowerCase() || null;
    case 'memo':
      return (tx.memo ?? '').trim().toLowerCase() || null;
    case 'iban':
      return extractIban(tx)?.toLowerCase() ?? null;
    default:
      return null;
  }
}

function extractIban(tx: { raw?: Record<string, unknown> }): string | null {
  const raw = tx.raw ?? {};
  const iban = (raw.counterpartyIban ?? raw.accountIban ?? raw.iban ?? '') as string;
  const normalized = iban.replace(/\s+/g, '');
  return normalized.length ? normalized : null;
}
