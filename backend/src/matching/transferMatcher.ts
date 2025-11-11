import type { NormalizedTransaction } from '../types/transactions';
import type { TransferLink } from '../types/core';

export interface MatchOptions {
  minutesWindow?: number;
  centsTolerance?: number;
}

const DEFAULT_OPTIONS: Required<MatchOptions> = {
  minutesWindow: 3 * 24 * 60,
  centsTolerance: 2,
};

const PAYPAL_DESCRIPTOR = [/paypal/i, /pp\./i, /europe s\.?.*r\.l/i];
const TRANSFER_HINT = /(transfer|withdrawal|payout|add funds|top\s?up)/i;

interface Candidate {
  tx: NormalizedTransaction;
  amount: number;
  bookedAt: number;
  text: string;
}

interface ScoredMatch {
  paypal: Candidate;
  bank: Candidate;
  score: number;
  reasons: string[];
}

export function matchInternalTransfers(
  paypalTxs: NormalizedTransaction[],
  bankTxs: NormalizedTransaction[],
  options: MatchOptions = {},
): { links: TransferLink[]; updated: NormalizedTransaction[] } {
  const cfg = { ...DEFAULT_OPTIONS, ...options };

  const feeReferences = buildFeeReferenceSet(paypalTxs);

  const paypalCandidates = paypalTxs
    .filter(tx => tx.source === 'csv_paypal')
    .map(toCandidate)
    .filter((candidate): candidate is Candidate => candidate !== null);

  const bankCandidates = bankTxs
    .filter(tx => tx.source !== 'csv_paypal')
    .map(toCandidate)
    .filter((candidate): candidate is Candidate => candidate !== null);

  if (!paypalCandidates.length || !bankCandidates.length) {
    return { links: [], updated: [] };
  }

  const bankIndex = buildAmountIndex(bankCandidates);
  const matches: ScoredMatch[] = [];

  for (const paypal of paypalCandidates) {
    const potential = findBestMatch(paypal, bankIndex, cfg, feeReferences);
    if (potential) matches.push(potential);
  }

  const usedPaypal = new Set<string>();
  const usedBank = new Set<string>();
  const links: TransferLink[] = [];
  const updatedMap = new Map<string, NormalizedTransaction>();

  for (const match of matches.sort((a, b) => b.score - a.score)) {
    const paypalId = match.paypal.tx.id;
    const bankId = match.bank.tx.id;
    if (usedPaypal.has(paypalId) || usedBank.has(bankId)) continue;
    usedPaypal.add(paypalId);
    usedBank.add(bankId);

    const createdAt = new Date(Math.min(match.paypal.bookedAt, match.bank.bookedAt)).toISOString();
    const link: TransferLink = {
      id: `transfer:${paypalId}->${bankId}`,
      fromTxId: match.paypal.tx.amountCents < 0 ? paypalId : bankId,
      toTxId: match.paypal.tx.amountCents < 0 ? bankId : paypalId,
      kind: 'internal_transfer',
      score: Math.min(1, match.score),
      reasons: match.reasons,
      createdAt,
    };
    links.push(link);

    const paypalUpdated: NormalizedTransaction = {
      ...match.paypal.tx,
      category: 'transfer_internal',
      isInternalTransfer: true,
      transferLinkId: link.id,
      categoryConfidence: Math.max(match.paypal.tx.categoryConfidence ?? 0.95, 0.95),
      metadata: {
        ...(match.paypal.tx.metadata ?? {}),
        transferReasons: match.reasons.join(','),
      },
    };

    const bankUpdated: NormalizedTransaction = {
      ...match.bank.tx,
      category: 'transfer_internal',
      isInternalTransfer: true,
      transferLinkId: link.id,
      categoryConfidence: Math.max(match.bank.tx.categoryConfidence ?? 0.95, 0.95),
      metadata: {
        ...(match.bank.tx.metadata ?? {}),
        transferReasons: match.reasons.join(','),
      },
    };

    updatedMap.set(paypalUpdated.id, paypalUpdated);
    updatedMap.set(bankUpdated.id, bankUpdated);
  }

  return { links, updated: Array.from(updatedMap.values()) };
}

function toCandidate(tx: NormalizedTransaction): Candidate | null {
  if (!tx.bookingDate) return null;
  const timestamp = Date.parse(tx.bookingDate.includes('T') ? tx.bookingDate : `${tx.bookingDate}T00:00:00Z`);
  if (Number.isNaN(timestamp)) return null;
  const descriptor = [tx.payee, tx.memo, tx.rawText]
    .filter(Boolean)
    .map(value => value!.toString().toLowerCase())
    .join(' ');
  return {
    tx,
    amount: tx.amountCents,
    bookedAt: timestamp,
    text: descriptor,
  };
}

function buildAmountIndex(records: Candidate[]): Map<number, Candidate[]> {
  const index = new Map<number, Candidate[]>();
  for (const record of records) {
    const list = index.get(record.amount) ?? [];
    list.push(record);
    index.set(record.amount, list);
  }
  for (const [amount, list] of index.entries()) {
    list.sort((a, b) => a.bookedAt - b.bookedAt || a.tx.id.localeCompare(b.tx.id));
    index.set(amount, list);
  }
  return index;
}

function findBestMatch(paypal: Candidate, index: Map<number, Candidate[]>, cfg: Required<MatchOptions>, feeReferences: Set<string>): ScoredMatch | null {
  if (!looksLikeTransfer(paypal)) return null;

  const tolerance = cfg.centsTolerance;
  const candidates: ScoredMatch[] = [];
  for (let delta = -tolerance; delta <= tolerance; delta += 1) {
    const list = index.get(-paypal.amount + delta);
    if (!list?.length) continue;
    for (const bank of list) {
      const evaluation = evaluate(paypal, bank, cfg, feeReferences);
      if (evaluation.score > 0) candidates.push(evaluation);
    }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score || a.bank.bookedAt - b.bank.bookedAt || a.bank.tx.id.localeCompare(b.bank.tx.id));
  const best = candidates[0];
  return best.score >= 0.8 ? best : null;
}

function evaluate(paypal: Candidate, bank: Candidate, cfg: Required<MatchOptions>, feeReferences: Set<string>): ScoredMatch {
  const reasons: string[] = [];
  let score = 0;

  if (Math.abs(paypal.amount + bank.amount) <= cfg.centsTolerance) {
    score += 0.4;
    reasons.push('amount_match');
  }

  const minutesDiff = Math.abs(paypal.bookedAt - bank.bookedAt) / 1000 / 60;
  if (minutesDiff <= cfg.minutesWindow) {
    score += minutesDiff <= 1440 ? 0.3 : 0.2;
    reasons.push('date_within_window');
  }

  if (PAYPAL_DESCRIPTOR.some(pattern => pattern.test(bank.text))) {
    score += 0.2;
    reasons.push('descriptor_match');
  }

  if (paypal.tx.referenceId && bank.tx.referenceId && paypal.tx.referenceId === bank.tx.referenceId) {
    score += 0.1;
    reasons.push('reference_match');
  }

  const refKeys = [paypal.tx.referenceId, paypal.tx.externalId].filter(Boolean) as string[];
  if (refKeys.some(key => feeReferences.has(key))) {
    reasons.push('fee_associated');
  }

  return { paypal, bank, score, reasons };
}

function looksLikeTransfer(candidate: Candidate): boolean {
  if (candidate.tx.isTransfer || candidate.tx.isInternalTransfer) return true;
  if (candidate.tx.metadata?.transferHint === true) return true;
  return TRANSFER_HINT.test(candidate.text);
}

function buildFeeReferenceSet(txs: NormalizedTransaction[]): Set<string> {
  const set = new Set<string>();
  for (const tx of txs) {
    if (tx.category !== 'paypal_fee') continue;
    if (tx.referenceId) set.add(tx.referenceId);
    if (tx.externalId) set.add(tx.externalId);
  }
  return set;
}
