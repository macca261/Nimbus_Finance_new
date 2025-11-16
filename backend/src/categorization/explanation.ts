/**
 * Categorization explanation builder.
 * 
 * Provides user-friendly explanations for why a transaction was categorized
 * in a particular way, including refunds, internal transfers, reimbursements,
 * rule matches, heuristics, and fallback cases.
 */

import type { NormalizedTransaction } from '../types/transactions';

export interface CategorizationExplanation {
  code: string;
  text: string;
}

/**
 * Build a categorization explanation for a transaction.
 * 
 * Priority order:
 * 1. Refunds (highest priority)
 * 2. Internal transfers
 * 3. Reimbursements
 * 4. Rule-based matches
 * 5. Merchant fuzzy matches
 * 6. Heuristics
 * 7. Fallback / Sonstiges
 * 
 * @param tx - The normalized transaction
 * @returns Explanation with machine-readable code and human-readable text
 */
export function buildCategorizationExplanation(
  tx: NormalizedTransaction,
): CategorizationExplanation {
  // 1. Refunds (highest priority)
  if (tx.isRefund || tx.isRefunded) {
    return {
      code: 'refund_pair',
      text: 'Refund: original charge and refund net to 0 €',
    };
  }

  // 2. Internal transfers
  if (tx.isInternalTransfer) {
    const kind = tx.internalTransferKind ?? 'other';
    const direction = tx.internalTransferDirection ?? 'out';

    if (kind === 'savings') {
      if (direction === 'out') {
        return {
          code: 'internal_transfer_savings_out',
          text: 'Transfer to savings account',
        };
      } else {
        return {
          code: 'internal_transfer_savings_in',
          text: 'Transfer from savings account',
        };
      }
    } else if (kind === 'wallet') {
      if (direction === 'out') {
        return {
          code: 'internal_transfer_wallet_out',
          text: 'Top-up to wallet (e.g. PayPal)',
        };
      } else {
        return {
          code: 'internal_transfer_wallet_in',
          text: 'Withdrawal from wallet',
        };
      }
    } else {
      // other
      if (direction === 'out') {
        return {
          code: 'internal_transfer_other_out',
          text: 'Internal transfer between own accounts (outgoing)',
        };
      } else {
        return {
          code: 'internal_transfer_other_in',
          text: 'Internal transfer between own accounts (incoming)',
        };
      }
    }
  }

  // 3. Reimbursements
  if (tx.isReimbursement) {
    const role = tx.reimbursementRole;
    const ratio = tx.reimbursementShareRatio;

    if (role === 'payer') {
      return {
        code: 'reimbursement_payer',
        text: 'Shared expense: you paid and were reimbursed',
      };
    } else if (role === 'receiver') {
      if (ratio !== null && ratio !== undefined) {
        const percentage = Math.round(ratio * 100);
        return {
          code: 'reimbursement_receiver',
          text: `Reimbursement received for shared expense (~${percentage}% share)`,
        };
      } else {
        return {
          code: 'reimbursement_receiver',
          text: 'Reimbursement received for shared expense',
        };
      }
    } else {
      return {
        code: 'reimbursement_unknown',
        text: 'Shared expense reimbursement',
      };
    }
  }

  // 4. Rule-based matches
  const categorySource = tx.categorySource;
  const categorySourceStr = String(categorySource ?? '');
  const categoryId = tx.category;
  const ruleId = tx.categoryRuleId;

  if (categorySource === 'rule') {
    if (ruleId) {
      // Use rule ID if available
      return {
        code: `rule_${ruleId}`,
        text: `Categorised by rule (${ruleId}) as ${categoryId}`,
      };
    } else {
      // Fallback to category-based code
      return {
        code: `rule_${categoryId}`,
        text: `Categorised by rule as ${categoryId}`,
      };
    }
  }

  // 5. Merchant fuzzy matches
  if (categorySourceStr === 'merchant-db-fuzzy') {
    return {
      code: 'merchant_fuzzy',
      text: 'Matched known merchant by similarity (e.g. LIDL / REWE / Drillisch)',
    };
  }

  // 6. User rules
  if (categorySource === 'feedback' || categorySourceStr === 'user') {
    return {
      code: 'user_rule',
      text: 'Categorised by your custom rule',
    };
  }

  // 7. Heuristics
  if (categorySourceStr.startsWith('heuristic:')) {
    const heuristicType = categorySourceStr.replace('heuristic:', '');
    return {
      code: `heuristic_${heuristicType}`,
      text: `Detected via heuristic pattern (${heuristicType})`,
    };
  } else if (categorySource === 'heuristic') {
    // Fallback for generic heuristic
    return {
      code: `heuristic_${categoryId}`,
      text: `Detected via heuristic pattern (${categoryId})`,
    };
  }

  // 8. Fallback / Sonstiges
  if (categoryId === 'other' || categoryId === 'other_review' || categorySource === 'fallback') {
    return {
      code: 'fallback_other_no_match',
      text: 'Other/uncategorized: no rule or merchant match yet',
    };
  }

  // 9. Default fallback (should never happen, but ensures function is total)
  return {
    code: 'unknown',
    text: `Categorised as ${categoryId} (source: ${categorySource ?? 'unknown'})`,
  };
}

