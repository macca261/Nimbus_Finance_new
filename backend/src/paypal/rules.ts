import type { CategoryId } from '../types/category';
import type { Transaction } from '../types/core';

const DELIVERY_PATTERNS = [/uber\s*\*?eats/i, /ubereats/i, /lieferando/i, /deliveroo/i, /wolt/i, /justeat/i];
const UBER_RIDE_PATTERNS = [/uber\s+trip/i, /uber\s+ride/i, /uber\s+help/i];
const BAKERY_PATTERNS = [/bäckerei/i, /baeckerei/i, /bakery/i, /café/i, /cafe\b/i, /espresso/i, /konditorei/i];
const SUBSCRIPTION_PATTERNS = [/openai/i, /chatgpt/i, /netflix/i, /spotify/i, /youtube\s+premium/i, /disney\+/i, /microsoft\s*365/i, /icloud/i, /1password/i, /audible/i, /notion/i, /github/i];
const TELECOM_PATTERNS = [/drillisch/i, /win\s*sim/i, /vodafone/i, /telekom/i, /o2\b/i, /1&1/i, /1und1/i, /congstar/i, /freenet/i];
const TRANSFER_PATTERNS = [
  /transfer to bank/i,
  /transfer from bank/i,
  /bank transfer/i,
  /withdrawal/i,
  /top.?up/i,
  /add funds/i,
  /bankgutschrift auf paypal-konto/i,
  /von nutzer eingeleitete abbuchung/i,
];
const REFUND_PATTERNS = [/refund/i, /reversal/i, /chargeback/i];
const FEE_PATTERNS = [/\bfee\b/i, /geb(ü|ue)hr/i, /commission/i];
const HOLD_PATTERNS = [/hold/i, /release/i];
const P2P_PATTERNS_IN = [/payment received/i, /friends? and family received/i, /money received/i];
const P2P_PATTERNS_OUT = [/friends? and family payment/i, /send money/i, /p2p payment/i];
const TRANSPORT_PATTERNS = [/bahn/i, /db\b/i, /bvg/i, /flixbus/i, /taxi/i, /ride/i];
const GROCERIES_PATTERNS = [/rewe/i, /edeka/i, /lidl/i, /aldi/i, /kaufland/i, /penny/i, /netto(?!\s*bank)/i];

function setReason(tx: Transaction, reason: string) {
  if (!tx.raw) tx.raw = {};
  (tx.raw as Record<string, unknown>).paypalCategoryReason = reason;
}

export function categorizePaypal(tx: Transaction): CategoryId | undefined {
  const text = [tx.payee, tx.memo, (tx.raw as Record<string, unknown> | undefined)?.paypalType]
    .map(value => (value ?? '').toString().toLowerCase())
    .join(' ');
  const amount = tx.amountCents;

  const match = (patterns: RegExp[]) => patterns.some(pattern => pattern.test(text));

  if (match(FEE_PATTERNS)) {
    setReason(tx, 'paypal_rule_fee');
    return 'paypal_fee';
  }

  if (match(REFUND_PATTERNS) || (amount > 0 && tx.referenceId && match(P2P_PATTERNS_IN))) {
    setReason(tx, 'paypal_rule_refund');
    return 'paypal_refund';
  }

  if (match(HOLD_PATTERNS)) {
    setReason(tx, 'paypal_rule_hold');
    return 'paypal_hold';
  }

  if (match(TRANSFER_PATTERNS)) {
    setReason(tx, 'paypal_rule_transfer_internal');
    tx.isTransferLikeHint = true;
    return 'transfer_internal';
  }

  if (match(DELIVERY_PATTERNS)) {
    setReason(tx, 'paypal_rule_delivery');
    return 'delivery';
  }

  if (match(UBER_RIDE_PATTERNS) || (text.includes('uber') && !match(DELIVERY_PATTERNS))) {
    setReason(tx, 'paypal_rule_transport_uber');
    return 'transport';
  }

  if (match(BAKERY_PATTERNS)) {
    setReason(tx, 'paypal_rule_dining_bakery');
    return 'dining_out';
  }

  if (match(SUBSCRIPTION_PATTERNS)) {
    setReason(tx, 'paypal_rule_subscription');
    return 'subscriptions';
  }

  if (match(TELECOM_PATTERNS)) {
    setReason(tx, 'paypal_rule_telecom');
    return 'telecom_internet';
  }

  if (match(GROCERIES_PATTERNS)) {
    setReason(tx, 'paypal_rule_groceries');
    return 'groceries';
  }

  if (amount > 0 && match(P2P_PATTERNS_IN)) {
    setReason(tx, 'paypal_rule_p2p_in');
    return 'p2p_in';
  }

  if (amount < 0 && match(P2P_PATTERNS_OUT)) {
    setReason(tx, 'paypal_rule_p2p_out');
    return 'p2p_out';
  }

  if (amount > 0 && text.includes('payment received')) {
    setReason(tx, 'paypal_rule_income_other');
    return 'income_other';
  }

  if (text.includes('mass payout')) {
    setReason(tx, 'paypal_rule_payout');
    return 'paypal_payout';
  }

  if (amount > 0 && text.includes('refund')) {
    setReason(tx, 'paypal_rule_refund_positive');
    return 'paypal_refund';
  }

  if (match(TRANSPORT_PATTERNS)) {
    setReason(tx, 'paypal_rule_transport_generic');
    return 'transport';
  }

  if (match([/store/i, /shop/i, /purchase/i])) {
    setReason(tx, 'paypal_rule_shopping');
    return 'shopping';
  }

  if (text.includes('currency conversion')) {
    setReason(tx, 'paypal_rule_fx');
    return 'currency_conversion_diff';
  }

  if (match([/payment received/i])) {
    setReason(tx, 'paypal_rule_income_other_fallback');
    return 'income_other';
  }

  setReason(tx, 'paypal_rule_other');
  return 'other';
}
