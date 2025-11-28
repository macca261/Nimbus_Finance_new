import { describe, it, expect, vi } from 'vitest';
import type { CanonicalTransaction } from '@nimbus/shared/src/types/canonical';
import { categoriseWithRulesOnly } from '../applyRules';

vi.mock('../storeDecision', () => ({
  storeCategoryDecision: vi.fn((input: any) => ({
    id: `decision-${input.ruleId ?? 'rule'}`,
    transactionId: input.transactionId,
    categoryId: input.categoryId,
    confidence: input.confidence,
    source: input.source,
    modelVersion: input.modelVersion,
    ruleId: input.ruleId,
    createdAt: '2025-01-01T00:00:00.000Z',
  })),
}));

vi.mock('../categoriesProvider', () => ({
  getSharedCategories: () => [
    { id: 'income_salary', label: 'Gehalt & Lohn', groupId: 'income', taxTag: null, isIncome: true, order: 1 },
    { id: 'groceries_supermarkets', label: 'Lebensmittel', groupId: 'essential_living', taxTag: 'PRIVAT', isIncome: false, order: 2 },
    { id: 'mobility_public_transport', label: 'ÖPNV', groupId: 'mobility', taxTag: 'WERBUNGSKOSTEN', isIncome: false, order: 3 },
    { id: 'financial_bank_fees', label: 'Bankgebühren', groupId: 'financial', taxTag: 'PRIVAT', isIncome: false, order: 4 },
  ],
}));

function buildTx(overrides: Partial<CanonicalTransaction>): CanonicalTransaction {
  return {
    id: 'tx-test',
    bookingDate: '2025-01-10',
    amount: -100,
    currency: 'EUR',
    purpose: 'Test',
    ...overrides,
  };
}

describe('categoriseWithRulesOnly', () => {
  it('categorises salary inflow', async () => {
    const tx = buildTx({
      id: 'tx-salary',
      amount: 2800,
      counterpartName: 'ACME Corp',
      purpose: 'Gehalt Januar',
    });

    const decision = await categoriseWithRulesOnly(tx);
    expect(decision).not.toBeNull();
    expect(decision?.categoryId).toBe('income_salary');
  });

  it('categorises supermarket transaction', async () => {
    const tx = buildTx({
      id: 'tx-rewe',
      amount: -85.4,
      counterpartName: 'REWE Markt 123',
      purpose: 'Lebensmittel Einkauf',
    });

    const decision = await categoriseWithRulesOnly(tx);
    expect(decision?.categoryId).toBe('groceries_supermarkets');
  });

  it('categorises public transport', async () => {
    const tx = buildTx({
      id: 'tx-bvg',
      amount: -49,
      counterpartName: 'BVG ABONNEMENT',
      purpose: 'Deutschlandticket',
    });

    const decision = await categoriseWithRulesOnly(tx);
    expect(decision?.categoryId).toBe('mobility_public_transport');
  });

  it('categorises bank fees', async () => {
    const tx = buildTx({
      id: 'tx-fee',
      amount: -9.99,
      counterpartName: 'Meine Bank',
      purpose: 'Kontofuehrungsgebuehr',
    });

    const decision = await categoriseWithRulesOnly(tx);
    expect(decision?.categoryId).toBe('financial_bank_fees');
  });
});


