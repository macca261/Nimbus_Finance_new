import type { CategoryId } from '../types/category';
import type { Transaction, UserOverrideRule } from '../types/core';

export interface OverrideResult {
  rule: UserOverrideRule;
  categoryId: CategoryId;
}

export function findMatchingOverride(tx: Transaction, rules: UserOverrideRule[]): OverrideResult | undefined {
  const ordered = [...rules].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  for (const rule of ordered) {
    if (matchesRule(rule, tx)) {
      return { rule, categoryId: rule.categoryId };
    }
  }
  return undefined;
}

function matchesRule(rule: UserOverrideRule, tx: Transaction): boolean {
  const pattern = rule.pattern.toLowerCase();
  switch (rule.patternType) {
    case 'payee':
      return (tx.payee ?? '').toLowerCase().includes(pattern);
    case 'memo':
      return (tx.memo ?? '').toLowerCase().includes(pattern);
    case 'iban': {
      const iban = (tx.raw?.counterpartyIban ?? tx.raw?.accountIban ?? tx.raw?.iban ?? '').toString().replace(/\s+/g, '').toLowerCase();
      return iban === pattern;
    }
    case 'mcc': {
      const mcc = (tx.raw?.mcc ?? '').toString().toLowerCase();
      return mcc === pattern;
    }
    case 'fingerprint':
      return tx.id.toLowerCase() === pattern;
    default:
      return false;
  }
}
