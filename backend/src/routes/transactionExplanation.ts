/**
 * Transaction Explanation API Routes
 * 
 * Provides endpoints for fetching categorization explanations ("Warum diese Kategorie?").
 * Powers the transparent explanation panel in the frontend.
 */

import { Router } from 'express';
import { rawDb } from '../db';
import type { CategorizationTrace } from '../types/core';

const router = Router();

export interface TransactionExplanationResponse {
  transactionId: number | string;
  categoryId: string | null;
  displayName: string;
  amountCents: number;
  date: string;
  trace: CategorizationTrace | null;
  aiSummary?: string | null; // optional, short human text for panel
}

/**
 * GET /api/transactions/:id/explanation
 * 
 * Returns categorization explanation for a transaction.
 */
router.get('/:id/explanation', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid transaction id' });
    }

    const row = rawDb
      .prepare(
        `SELECT 
          id, 
          category as categoryId, 
          payee as displayName, 
          amountCents, 
          bookingDate as date, 
          categorization_trace as categorizationTrace
         FROM transactions 
         WHERE id = ?`
      )
      .get(id) as {
        id: number;
        categoryId: string | null;
        displayName: string | null;
        amountCents: number;
        date: string;
        categorizationTrace: string | null;
      } | undefined;

    if (!row) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    let trace: CategorizationTrace | null = null;
    if (row.categorizationTrace) {
      try {
        trace = JSON.parse(row.categorizationTrace) as CategorizationTrace;
      } catch (e) {
        // eslint-disable-next-line no-console
        if (process.env.NODE_ENV !== 'production') {
          console.error('[explanation] Failed to parse trace JSON', e);
        }
      }
    }

    const payload: TransactionExplanationResponse = {
      transactionId: row.id,
      categoryId: row.categoryId ?? null,
      displayName: row.displayName || 'Unbekannt',
      amountCents: row.amountCents,
      date: row.date,
      trace,
      aiSummary: trace?.llmReasoning ?? null,
    };

    res.json(payload);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[transactionExplanation] Error', err);
    res.status(500).json({ error: 'Failed to load transaction explanation' });
  }
});

export default router;

