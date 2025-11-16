import type { ParsedRow } from '../parser/types';
import type { CategoryId } from './categoryRegistry';

export interface TransferMatch {
  category: CategoryId;
  confidence: number;
  reason: string;
}

/**
 * Stage 5: Transfer / internal movement detection
 * Detects transfers between own accounts, savings movements, etc.
 */
export function detectTransfer(row: ParsedRow, cleanedText: string): TransferMatch | null {
  const text = cleanedText.toUpperCase();
  const direction = row.direction;

  // Internal transfers - look for keywords
  const transferKeywords = [
    'ÜBERTRAG',
    'UEBERTRAG',
    'ÜBERWEISUNG',
    'UEBERWEISUNG',
    'INSTANT TRANSFER',
    'DAUERAUFTRAG',
    'EIGENÜBERWEISUNG',
    'EIGENUEBERWEISUNG',
  ];

  const hasTransferKeyword = transferKeywords.some(keyword => text.includes(keyword));

  if (hasTransferKeyword) {
    // Check if counterparty suggests it's an internal transfer
    const counterparty = (row.counterparty ?? '').toUpperCase();
    const isOwnAccount =
      /^(PAYPAL|AARON|MCINTOSH|EIGEN|OWN|SPARKONTO|GIROKONTO|DEPOT)/i.test(counterparty) ||
      counterparty.length === 0; // Empty counterparty often means internal

    if (isOwnAccount) {
      // Check for savings-related keywords
      if (
        text.includes('SPAREN') ||
        text.includes('SPARKONTO') ||
        text.includes('DEPOT') ||
        text.includes('SAVINGS')
      ) {
        return {
          category: 'internal:savings',
          confidence: 0.85,
          reason: 'transfer:savings',
        };
      }

      return {
        category: 'internal:own-account',
        confidence: 0.8,
        reason: 'transfer:own_account',
      };
    }
  }

  // Check for round amounts that might be transfers (heuristic)
  const amount = Math.abs(row.amountCents);
  if (amount > 0 && amount % 10000 === 0 && hasTransferKeyword) {
    // Round amounts (multiples of 100 EUR) are often transfers
    return {
      category: 'internal:own-account',
      confidence: 0.7,
      reason: 'transfer:round_amount',
    };
  }

  return null;
}

