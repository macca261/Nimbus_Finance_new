import type { NormalizedCanonicalRow } from '../db';

export interface RefundMatchConfig {
  daysWindow?: number; // default 90
}

/**
 * Normalize merchant/description text for matching.
 * Lowercase, strip extra spaces, and remove obvious noise.
 */
function normalizeMerchantText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .trim();
}

/**
 * Check if two merchant/description texts are similar enough to be a refund pair.
 * Uses normalized comparison.
 */
function isSimilarMerchant(a: string | null | undefined, b: string | null | undefined): boolean {
  const normA = normalizeMerchantText(a);
  const normB = normalizeMerchantText(b);
  
  // Exact match after normalization
  if (normA === normB) return true;
  
  // Check if one contains the other (for cases like "EUROP ASSISTANCE" vs "EUROP ASSISTANCE, PARIS FR")
  if (normA.length > 0 && normB.length > 0) {
    if (normA.includes(normB) || normB.includes(normA)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Find a refund pair for a candidate transaction.
 * 
 * Requirements:
 * - Same accountId
 * - Same absolute amount in cents
 * - Opposite sign (one < 0, one > 0)
 * - Similar merchant / description
 * - Booking dates within N days (default 90)
 * - Neither row is already part of a refund pair
 * 
 * @param candidate - The transaction to find a pair for
 * @param existingRows - Array of existing transactions to search
 * @param config - Configuration options
 * @returns The matching transaction if found, null otherwise
 */
export function findRefundPair(
  candidate: NormalizedCanonicalRow,
  existingRows: NormalizedCanonicalRow[],
  config: RefundMatchConfig = {},
): NormalizedCanonicalRow | null {
  const daysWindow = config.daysWindow ?? 90;
  
  // Skip if candidate is already part of a refund pair
  if (candidate.isRefund || candidate.isRefunded || candidate.refundGroupId) {
    return null;
  }
  
  const candidateAmount = candidate.amountCents;
  const candidateAbsAmount = Math.abs(candidateAmount);
  const candidateDate = new Date(candidate.bookingDate);
  const candidateMerchant = candidate.counterpartName ?? candidate.purpose ?? '';
  
  // Find matching transaction
  for (const existing of existingRows) {
    // Skip if existing is already part of a refund pair
    if (existing.isRefund || existing.isRefunded || existing.refundGroupId) {
      continue;
    }
    
    // Must be same account
    if (candidate.accountId !== existing.accountId) {
      continue;
    }
    
    // Must be same absolute amount
    const existingAbsAmount = Math.abs(existing.amountCents);
    if (candidateAbsAmount !== existingAbsAmount) {
      continue;
    }
    
    // Must be opposite sign
    const existingAmount = existing.amountCents;
    if ((candidateAmount < 0 && existingAmount < 0) || 
        (candidateAmount > 0 && existingAmount > 0)) {
      continue;
    }
    
    // Must be similar merchant/description
    const existingMerchant = existing.counterpartName ?? existing.purpose ?? '';
    if (!isSimilarMerchant(candidateMerchant, existingMerchant)) {
      continue;
    }
    
  // Must be within date window (check both directions - refund can come before or after charge)
  const existingDate = new Date(existing.bookingDate);
  const daysDiff = Math.abs((candidateDate.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > daysWindow) {
    continue;
  }
    
    // All conditions met - found a match
    return existing;
  }
  
  return null;
}

/**
 * Link two transactions as a refund pair.
 * 
 * @param a - First transaction
 * @param b - Second transaction
 * @returns Object with charge (negative amount), refund (positive amount), and refundGroupId
 */
export function linkRefundPair(
  a: NormalizedCanonicalRow,
  b: NormalizedCanonicalRow,
): { charge: NormalizedCanonicalRow; refund: NormalizedCanonicalRow; refundGroupId: string } {
  // Determine which is charge (negative) and which is refund (positive)
  const charge = a.amountCents < 0 ? a : b;
  const refund = a.amountCents < 0 ? b : a;
  
  // Generate refundGroupId using publicIds (deterministic)
  const ids = [charge.publicId, refund.publicId].sort();
  const refundGroupId = `refund_${ids[0]}_${ids[1]}`;
  
  // Create copies with refund flags set
  const chargeWithFlags: NormalizedCanonicalRow = {
    ...charge,
    isRefunded: true,
    refundGroupId,
  };
  
  const refundWithFlags: NormalizedCanonicalRow = {
    ...refund,
    isRefund: true,
    refundGroupId,
  };
  
  return {
    charge: chargeWithFlags,
    refund: refundWithFlags,
    refundGroupId,
  };
}

