/**
 * Inbox API Routes
 * 
 * Provides endpoints for the "Inbox Zero" transaction review workflow.
 */

import { Router } from 'express';
import {
  getInboxTransactions,
  distributeTransaction,
  approveTransaction,
  skipTransaction,
  suggestCategoriesForReimbursement,
} from '../services/transactionService';
import { db as defaultDb } from '../db';

const router = Router();

/**
 * GET /api/inbox
 * 
 * Get transactions with status === 'inbox'
 */
router.get('/', (req, res) => {
  try {
    const db = (req.app as any)?.locals?.db ?? defaultDb;
    const limit = parseInt(req.query.limit as string, 10) || 100;

    const transactions = getInboxTransactions(db, limit);

    res.json({ transactions });
  } catch (err: any) {
    console.error('[routes/inbox] GET error:', err);
    res.status(500).json({ error: err?.message || 'Failed to fetch inbox transactions' });
  }
});

/**
 * POST /api/inbox/distribute
 * 
 * Distribute a transaction into multiple category allocations
 */
router.post('/distribute', (req, res) => {
  try {
    const db = (req.app as any)?.locals?.db ?? defaultDb;
    const input = req.body;

    const result = distributeTransaction(db, input);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, allocations: result.allocations });
  } catch (err: any) {
    console.error('[routes/inbox] POST /distribute error:', err);
    res.status(500).json({ error: err?.message || 'Failed to distribute transaction' });
  }
});

/**
 * POST /api/inbox/:transactionId/approve
 * 
 * Approve transaction (keep auto-category, mark as reviewed)
 */
router.post('/:transactionId/approve', (req, res) => {
  try {
    const db = (req.app as any)?.locals?.db ?? defaultDb;
    const { transactionId } = req.params;

    const result = approveTransaction(db, transactionId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('[routes/inbox] POST /approve error:', err);
    res.status(500).json({ error: err?.message || 'Failed to approve transaction' });
  }
});

/**
 * POST /api/inbox/:transactionId/skip
 * 
 * Skip transaction (mark as skipped)
 */
router.post('/:transactionId/skip', (req, res) => {
  try {
    const db = (req.app as any)?.locals?.db ?? defaultDb;
    const { transactionId } = req.params;

    const result = skipTransaction(db, transactionId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('[routes/inbox] POST /skip error:', err);
    res.status(500).json({ error: err?.message || 'Failed to skip transaction' });
  }
});

/**
 * GET /api/inbox/suggest-categories
 * 
 * Suggest categories for a PayPal reimbursement transaction
 */
router.get('/suggest-categories', (req, res) => {
  try {
    const db = (req.app as any)?.locals?.db ?? defaultDb;
    const amountCents = parseInt(req.query.amountCents as string, 10);

    if (isNaN(amountCents)) {
      return res.status(400).json({ error: 'Invalid amountCents parameter' });
    }

    const suggestions = suggestCategoriesForReimbursement(db, amountCents);

    res.json({ suggestions });
  } catch (err: any) {
    console.error('[routes/inbox] GET /suggest-categories error:', err);
    res.status(500).json({ error: err?.message || 'Failed to suggest categories' });
  }
});

export default router;

