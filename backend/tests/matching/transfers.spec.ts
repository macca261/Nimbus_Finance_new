import { describe, it, expect } from 'vitest';
import { matchInternalTransfers } from '../../src/matching/transferMatcher';
import type { NormalizedTransaction } from '../../src/types/transactions';

const basePaypalTx: NormalizedTransaction = {
  id: 'paypal:payout-1',
  bookingDate: '2024-10-12',
  valutaDate: '2024-10-12',
  amountCents: -10000,
  currency: 'EUR',
  direction: 'out',
  accountId: 'paypal:primary',
  rawText: 'Transfer to bank',
  bankProfile: 'paypal',
  category: 'transfer_internal',
  categoryConfidence: 1,
  categorySource: 'rule',
  categoryRuleId: 'fixture',
  raw: { paypalType: 'Transfer to bank', paypalFlags: 'transfer' },
  source: 'csv_paypal',
  sourceProfile: 'paypal_standard',
  payee: 'Max Mustermann',
  memo: 'Transfer to bank',
  externalId: 'PP123',
  referenceId: 'BANK123',
  isTransfer: true,
  isInternalTransfer: false,
  transferLinkId: null,
  confidence: 1,
  metadata: {},
};

const baseBankTx: NormalizedTransaction = {
  id: 'bank:credit-1',
  bookingDate: '2024-10-13',
  valutaDate: '2024-10-13',
  amountCents: 10000,
  currency: 'EUR',
  direction: 'in',
  accountId: 'bank:dkb:123',
  rawText: 'SEPA Gutschrift PAYPAL (EUROPE)',
  bankProfile: 'bank_standard',
  category: 'other_review',
  categoryConfidence: 0,
  categorySource: 'fallback',
  raw: { purpose: 'SEPA Gutschrift PAYPAL (EUROPE)' },
  source: 'csv_bank',
  sourceProfile: 'bank_standard',
  payee: 'PAYPAL (EUROPE) S.A.R.L. ET CIE',
  memo: 'SEPA Gutschrift PAYPAL (EUROPE)',
  externalId: null,
  referenceId: 'BANK123',
  isTransfer: false,
  isInternalTransfer: false,
  transferLinkId: null,
  confidence: null,
  metadata: {},
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

describe('matchInternalTransfers', () => {
  it('links PayPal payout to matching bank credit with reasons', () => {
    const paypal = clone(basePaypalTx);
    const bank = clone(baseBankTx);
    const fee: NormalizedTransaction = {
      ...clone(basePaypalTx),
      id: 'paypal:fee-1',
      amountCents: -35,
      category: 'paypal_fee',
      rawText: 'Fee for transfer',
      memo: 'Fee for transfer',
      externalId: 'PPFEE1',
      referenceId: 'BANK123',
      metadata: {},
    };

    const { links, updated } = matchInternalTransfers([paypal, fee], [bank]);
    expect(links).toHaveLength(1);
    const [link] = links;
    expect(link.kind).toBe('internal_transfer');
    expect(link.reasons).toEqual(expect.arrayContaining(['amount_match', 'date_within_window', 'descriptor_match', 'fee_associated']));

    const updatedMap = new Map(updated.map(tx => [tx.id, tx]));
    const updatedPaypal = updatedMap.get(paypal.id);
    const updatedBank = updatedMap.get(bank.id);
    expect(updatedPaypal?.category).toBe('transfer_internal');
    expect(updatedPaypal?.isInternalTransfer).toBe(true);
    expect(updatedBank?.category).toBe('transfer_internal');
    expect(updatedBank?.isInternalTransfer).toBe(true);
  });

  it('ignores candidates without PayPal descriptor', () => {
    const bank = clone(baseBankTx);
    bank.rawText = 'SEPA Gutschrift ACME CORP';
    bank.memo = 'SEPA Gutschrift ACME CORP';
    bank.payee = 'ACME CORP';
    bank.referenceId = null;
    const paypal = clone(basePaypalTx);
    paypal.referenceId = null;

    const { links } = matchInternalTransfers([paypal], [bank]);
    expect(links).toHaveLength(0);
  });

  it('ignores candidates outside the time window', () => {
    const paypal = clone(basePaypalTx);
    const bank = clone(baseBankTx);
    bank.bookingDate = '2024-11-01';

    const { links } = matchInternalTransfers([paypal], [bank], { minutesWindow: 60 });
    expect(links).toHaveLength(0);
  });
});
