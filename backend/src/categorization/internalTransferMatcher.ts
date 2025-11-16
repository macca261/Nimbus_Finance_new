import type { NormalizedCanonicalRow } from '../db';
import type { AccountRole } from '../types/core';

export type InternalTransferDirection = 'out' | 'in';
export type InternalTransferKind = 'savings' | 'wallet' | 'other';

export interface InternalTransferMatchConfig {
  daysWindow?: number; // default 3
  accountRoleById?: Record<string, AccountRole | undefined>;
  accountRoleByIban?: Record<string, AccountRole | undefined>;
}

export interface InternalTransferMatch {
  a: NormalizedCanonicalRow;
  b: NormalizedCanonicalRow;
  directionForA: InternalTransferDirection;
  directionForB: InternalTransferDirection;
  kind: InternalTransferKind;
  groupId: string;
}

/**
 * Normalize text for matching internal transfer patterns.
 */
function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if text contains internal transfer keywords.
 */
function hasInternalTransferKeywords(text: string): boolean {
  const normalized = normalizeText(text);
  const keywords = [
    'UBERTRAG',
    'UEBERTRAG',
    'INTERNER UBERTRAG',
    'INTERNER TRANSFER',
    'SPAREN',
    'TAGESGELD',
    'SPARKONTO',
    'PAYPAL',
    'TRANSFER',
    'UBERWEISUNG',
    'UEBERWEISUNG',
  ];
  return keywords.some(keyword => normalized.includes(keyword));
}

/**
 * Determine the kind of internal transfer based on text content.
 */
function determineKind(textA: string, textB: string): InternalTransferKind {
  const combined = normalizeText(textA) + ' ' + normalizeText(textB);
  
  if (combined.includes('SPAR') || combined.includes('TAGESGELD')) {
    return 'savings';
  }
  
  if (combined.includes('PAYPAL')) {
    return 'wallet';
  }
  
  return 'other';
}

/**
 * Find an internal transfer pair for a candidate transaction.
 * 
 * Requirements:
 * - Different accountId (must be between different accounts)
 * - Same absolute amount in cents
 * - Opposite sign (one < 0, one > 0)
 * - Booking dates within N days (default 3)
 * - Neither row is already part of an internal transfer pair
 * - Text contains internal transfer keywords
 * 
 * @param candidate - The transaction to find a pair for
 * @param others - Array of other transactions to search
 * @param config - Configuration options
 * @returns The matching transaction info if found, null otherwise
 */
export function findInternalTransferPair(
  candidate: NormalizedCanonicalRow,
  others: NormalizedCanonicalRow[],
  config: InternalTransferMatchConfig = {},
): InternalTransferMatch | null {
  const daysWindow = config.daysWindow ?? 3;
  const roleById = config.accountRoleById || {};
  const roleByIban = config.accountRoleByIban || {};
  
  // Skip if candidate is already part of an internal transfer pair
  if (candidate.isInternalTransfer || candidate.internalTransferGroupId) {
    return null;
  }
  
  // Skip if candidate is part of a refund pair (refunds take precedence)
  if (candidate.isRefund || candidate.isRefunded || candidate.refundGroupId) {
    return null;
  }
  
  const candidateAmount = candidate.amountCents;
  const candidateAbsAmount = Math.abs(candidateAmount);
  const candidateDate = new Date(candidate.bookingDate);
  const candidateText = candidate.counterpartName ?? candidate.purpose ?? '';
  const candidateAccountId = candidate.accountId;
  
  // Must have internal transfer keywords
  if (!hasInternalTransferKeywords(candidateText)) {
    return null;
  }
  
  // Find matching transaction
  for (const other of others) {
    // Skip if other is already part of an internal transfer pair
    if (other.isInternalTransfer || other.internalTransferGroupId) {
      continue;
    }
    
    // Skip if other is part of a refund pair
    if (other.isRefund || other.isRefunded || other.refundGroupId) {
      continue;
    }
    
    // Must be different account (internal transfers are between accounts)
    if (!candidateAccountId || !other.accountId || candidateAccountId === other.accountId) {
      continue;
    }
    
    // Must be same absolute amount
    const otherAbsAmount = Math.abs(other.amountCents);
    if (candidateAbsAmount !== otherAbsAmount) {
      continue;
    }
    
    // Must be opposite sign
    const otherAmount = other.amountCents;
    if ((candidateAmount < 0 && otherAmount < 0) || 
        (candidateAmount > 0 && otherAmount > 0)) {
      continue;
    }
    
    // Must have internal transfer keywords
    const otherText = other.counterpartName ?? other.purpose ?? '';
    if (!hasInternalTransferKeywords(otherText)) {
      continue;
    }
    
    // Must be within date window
    const otherDate = new Date(other.bookingDate);
    const daysDiff = Math.abs((candidateDate.getTime() - otherDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > daysWindow) {
      continue;
    }
    
    // All conditions met - found a match
    // Determine kind: prefer role-based savings if between spending <-> savings
    const roleA = candidateAccountId ? roleById[candidateAccountId] : undefined;
    const roleB = other.accountId ? roleById[other.accountId] : undefined;
    let kind: InternalTransferKind = 'other';
    if ((roleA === 'spending' && roleB === 'savings') || (roleA === 'savings' && roleB === 'spending')) {
      kind = 'savings';
    } else {
      kind = determineKind(candidateText, otherText);
    }
    
    // Determine direction: negative amount is 'out', positive is 'in'
    const directionForA: InternalTransferDirection = candidateAmount < 0 ? 'out' : 'in';
    const directionForB: InternalTransferDirection = otherAmount < 0 ? 'out' : 'in';
    
    // Generate deterministic groupId
    const ids = [candidate.publicId, other.publicId].sort();
    const groupId = `int_${ids[0]}_${ids[1]}`;
    
    return {
      a: candidate,
      b: other,
      directionForA,
      directionForB,
      kind,
      groupId,
    };
  }
  
  return null;
}

/**
 * Single-sided classification heuristic for internal transfers:
 * If an outgoing transfer goes to a counterparty IBAN that belongs to one of the user's accounts,
 * mark it as an internal transfer.
 * 
 * Priority:
 * 1. Savings/wallet accounts → kind = 'savings' or 'wallet'
 * 2. Any other account in accounts table → kind = 'other'
 */
export function classifySingleSidedSavingsTransfer(
  row: NormalizedCanonicalRow,
  config: InternalTransferMatchConfig = {},
): NormalizedCanonicalRow | null {
  const roleById = config.accountRoleById || {};
  const roleByIban = config.accountRoleByIban || {};
  if (row.isRefund || row.isRefunded || row.refundGroupId) return null;
  if (row.isInternalTransfer || row.internalTransferGroupId) return null;
  if (row.amountCents >= 0) return null; // only outgoing
  
  // Must have transfer keywords in the text (check purpose, not just counterpartName)
  const purposeText = (row.purpose ?? '').toUpperCase();
  const counterpartText = (row.counterpartName ?? '').toUpperCase();
  const combinedText = `${purposeText} ${counterpartText}`.trim();
  if (!hasInternalTransferKeywords(combinedText)) {
    return null;
  }
  
  const accountRole = row.accountId ? roleById[row.accountId] : undefined;
  const counterIban = row.counterpartyIban || null;
  const counterRole = counterIban ? roleByIban[counterIban] : undefined;
  
  // If counterparty IBAN is in accounts table, it's an internal transfer
  if (counterRole) {
    let kind: InternalTransferKind = 'other';
    if (counterRole === 'savings') {
      kind = 'savings';
    } else if (counterRole === 'wallet') {
      kind = 'wallet';
    }
    
    return {
      ...row,
      isInternalTransfer: true,
      internalTransferDirection: 'out',
      internalTransferKind: kind,
      internalTransferGroupId: row.internalTransferGroupId ?? `int_single_${row.publicId}`,
    };
  }
  
  // Legacy: spending -> savings/wallet (for backwards compatibility)
  if (accountRole === 'spending' && (counterRole === 'savings' || counterRole === 'wallet')) {
    const kind = (counterRole === 'wallet') ? 'wallet' : 'savings';
    return {
      ...row,
      isInternalTransfer: true,
      internalTransferDirection: 'out',
      internalTransferKind: kind,
      internalTransferGroupId: row.internalTransferGroupId ?? `int_single_${row.publicId}`,
    };
  }
  
  return null;
}

/**
 * Apply internal transfer flags to both rows in a match.
 * 
 * @param match - The internal transfer match
 * @returns Updated copies of both rows with flags set
 */
export function applyInternalTransferFlags(
  match: InternalTransferMatch,
): { a: NormalizedCanonicalRow; b: NormalizedCanonicalRow } {
  const aWithFlags: NormalizedCanonicalRow = {
    ...match.a,
    isInternalTransfer: true,
    internalTransferDirection: match.directionForA,
    internalTransferKind: match.kind,
    internalTransferGroupId: match.groupId,
  };
  
  const bWithFlags: NormalizedCanonicalRow = {
    ...match.b,
    isInternalTransfer: true,
    internalTransferDirection: match.directionForB,
    internalTransferKind: match.kind,
    internalTransferGroupId: match.groupId,
  };
  
  return { a: aWithFlags, b: bWithFlags };
}

