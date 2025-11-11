import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parsePaypalCsv } from '../../src/paypal/parser';
import { categorize } from '../../src/categorization';
import { fixturePath } from '../helpers/test-utils';

const ACCOUNT_ID = 'paypal:primary';

function simplify(tx: ReturnType<typeof parsePaypalCsv>[number]) {
  const raw = tx.raw ? Object.fromEntries(Object.entries(tx.raw as Record<string, unknown>).sort()) : undefined;
  return {
    id: tx.id,
    bookingDate: tx.bookingDate,
    amountCents: tx.amountCents,
    currency: tx.currency,
    payee: tx.payee,
    memo: tx.memo,
    externalId: tx.externalId,
    referenceId: tx.referenceId,
    raw,
  };
}

function categorizeTx(tx: ReturnType<typeof parsePaypalCsv>[number]) {
  const result = categorize({
    text: [tx.payee, tx.memo].filter(Boolean).join(' '),
    amount: tx.amountCents / 100,
    amountCents: tx.amountCents,
    memo: tx.memo,
    payee: tx.payee,
    source: tx.source,
    transaction: tx,
  });
  return result.category;
}

describe('parsePaypalCsv', () => {
  it('parses real PayPal export and categorizes merchants correctly', () => {
    const csv = readFileSync(fixturePath('paypal_basic.csv'), 'utf8');

    const transactions = parsePaypalCsv(csv, { accountId: ACCOUNT_ID, profile: 'paypal_standard' });
    expect(transactions).toHaveLength(11);

    const categoryById = new Map(transactions.map(tx => [tx.externalId, categorizeTx(tx)]));

    expect(categoryById.get('PAYPAL-UBEREATS-1')).toBe('delivery');
    expect(categoryById.get('PAYPAL-UBERTRIP-1')).toBe('transport');
    expect(categoryById.get('PAYPAL-BAECKEREI-1')).toBe('dining_out');
    expect(categoryById.get('PAYPAL-OPENAI-1')).toBe('subscriptions');
    expect(categoryById.get('PAYPAL-DRILLISCH-1')).toBe('telecom_internet');
    expect(categoryById.get('PAYPAL-FEE-1')).toBe('paypal_fee');
    expect(categoryById.get('PAYPAL-TRANSFER-1')).toBe('transfer_internal');
    expect(categoryById.get('PAYPAL-REFUND-1')).toBe('paypal_refund');
    expect(categoryById.get('PAYPAL-P2PIN-1')).toBe('p2p_in');
    expect(categoryById.get('PAYPAL-P2POUT-1')).toBe('p2p_out');
    expect(categoryById.get('PAYPAL-GENERIC-1')).toBe('shopping');

    const uberEats = transactions.find(tx => tx.externalId === 'PAYPAL-UBEREATS-1');
    expect(uberEats?.amountCents).toBe(-2575);
    expect(uberEats?.raw?.paypalCategoryReason).toBe('paypal_rule_delivery');

    const payout = transactions.find(tx => tx.externalId === 'PAYPAL-TRANSFER-1');
    expect(payout?.isTransferLikeHint).toBe(true);
    expect(payout?.raw?.paypalCategoryReason).toBe('paypal_rule_transfer_internal');
  });

  it('parses PayPal CSV deterministically', () => {
    const csv = readFileSync(fixturePath('paypal_basic.csv'), 'utf8');

    const first = parsePaypalCsv(csv, { accountId: ACCOUNT_ID, profile: 'paypal_standard' });
    const second = parsePaypalCsv(csv, { accountId: ACCOUNT_ID, profile: 'paypal_standard' });

    const sortedA = first.slice().sort((a, b) => (a.externalId ?? '').localeCompare(b.externalId ?? ''));
    const sortedB = second.slice().sort((a, b) => (a.externalId ?? '').localeCompare(b.externalId ?? ''));

    expect(JSON.stringify(sortedA.map(simplify))).toBe(JSON.stringify(sortedB.map(simplify)));
  });
});
