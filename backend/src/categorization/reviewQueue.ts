import type { Database } from '../db';
import type { CategorizedTransaction } from './types';

export interface ReviewTransaction {
  id: string;
  bookingDate: string;
  amountCents: number;
  currency: string;
  direction: 'in' | 'out';
  category: string | null;
  categorySource: string | null;
  categoryConfidence: number | null;
  categoryExplanation?: {
    ruleId: string;
    merchantName?: string;
    matchedText?: string;
  } | null;
  rawText: string;
}

export interface ReviewQueryOptions {
  limit?: number;
  maxConfidence?: number; // only show <= this confidence when present
}

/**
 * Returns transactions that most need user review:
 * - unknown or fallback category source
 * - or category 'other'
 * - or low categoryConfidence (<= maxConfidence)
 *
 * Sorted by:
 *   1) categoryConfidence ascending (nulls treated as 0)
 *   2) bookingDate descending
 *   3) createdAt descending
 *   4) id descending
 */
export async function getTransactionsForReview(
  db: Database,
  options: ReviewQueryOptions = {},
): Promise<ReviewTransaction[]> {
  const limit = options.limit ?? 50;
  const maxConfidence = options.maxConfidence ?? 0.5;

  // Query transactions that need review
  type Row = {
    id: number;
    booking_date: string;
    amount_cents: number;
    currency: string;
    direction: 'in' | 'out';
    category_id: string | null;
    category_source: string | null;
    category_confidence: number | null;
    category_explanation_json?: string | null;
    raw_text: string;
    created_at: string;
  };

  const rows = db
    .prepare(
      `
      SELECT
        id,
        bookingDate AS booking_date,
        amountCents AS amount_cents,
        currency,
        direction,
        category AS category_id,
        category_source,
        category_confidence,
        category_explanation AS category_explanation_json,
        purpose AS raw_text,
        createdAt AS created_at
      FROM transactions
      WHERE
        -- suspicious or low-quality categories
        (
          (category IS NULL OR category = 'other')
          OR (category_source IS NULL OR category_source = 'unknown' OR category_source = 'fallback')
          OR (category_confidence IS NULL OR (category_confidence IS NOT NULL AND category_confidence <= ?))
        )
        -- Exclude high-confidence rule-based transactions
        -- Exclude if: rule-based, has a category (not null/other), and (confidence is null OR confidence > threshold)
        -- This means we only include rule-based transactions if they have low confidence explicitly set
        AND NOT (
          category_source = 'rule'
          AND category IS NOT NULL
          AND category != 'other'
          AND (category_confidence IS NULL OR category_confidence > ?)
        )
      ORDER BY
        COALESCE(category_confidence, 0.0) ASC,
        bookingDate DESC,
        createdAt DESC,
        id DESC
      LIMIT ?
    `,
    )
    .all(maxConfidence, maxConfidence, limit) as Row[];

  return rows.map(row => {
    let explanation: ReviewTransaction['categoryExplanation'] = null;
    if (row.category_explanation_json) {
      try {
        explanation = JSON.parse(row.category_explanation_json);
      } catch {
        explanation = null;
      }
    }

    return {
      id: String(row.id),
      bookingDate: row.booking_date,
      amountCents: row.amount_cents,
      currency: row.currency,
      direction: row.direction,
      category: row.category_id,
      categorySource: row.category_source,
      categoryConfidence: row.category_confidence,
      categoryExplanation: explanation,
      rawText: row.raw_text,
    };
  });
}

