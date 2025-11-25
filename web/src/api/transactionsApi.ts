/**
 * Transactions API Client
 * 
 * Provides functions for fetching transaction data and explanations.
 */

export interface TransactionExplanation {
  transactionId: number | string;
  categoryId: string | null;
  displayName: string;
  amountCents: number;
  date: string;
  trace: {
    method: 'RULE' | 'ML' | 'LLM' | 'UNKNOWN';
    confidence: number;
    ruleMatchId?: string;
    ruleDescription?: string;
    mlModel?: string;
    llmModel?: string;
    llmReasoning?: string;
    createdAt: string;
  } | null;
  aiSummary?: string | null;
}

/**
 * Fetch categorization explanation for a transaction
 */
export async function fetchTransactionExplanation(
  id: number | string
): Promise<TransactionExplanation> {
  const res = await fetch(`/api/transactions/${id}/explanation`);
  if (!res.ok) {
    throw new Error(`Failed to fetch explanation for transaction ${id}`);
  }
  return res.json();
}

