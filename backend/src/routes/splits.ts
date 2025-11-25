/**
 * Transaction Splits API Routes
 * 
 * Provides endpoints for splitting transactions into multiple category allocations.
 */

import { Router } from 'express';
import { executeSplit, getTransactionWithSplits, type SplitInput } from '../services/splitService';
import { db as defaultDb } from '../db';

const router = Router();

/**
 * POST /api/splits
 * 
 * Create or update splits for a transaction
 */
router.post('/', (req, res) => {
  try {
    const db = (req.app as any)?.locals?.db ?? defaultDb;
    const input = req.body as SplitInput;

    const result = executeSplit(db, input);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, splits: result.splits });
  } catch (err: any) {
    console.error('[routes/splits] POST error:', err);
    res.status(500).json({ error: err?.message || 'Failed to create splits' });
  }
});

/**
 * GET /api/splits/:transactionId
 * 
 * Get all splits for a transaction
 */
router.get('/:transactionId', (req, res) => {
  try {
    const db = (req.app as any)?.locals?.db ?? defaultDb;
    const transactionId = parseInt(req.params.transactionId, 10);

    if (isNaN(transactionId)) {
      return res.status(400).json({ error: 'Invalid transaction ID' });
    }

    const { transaction, splits } = getTransactionWithSplits(db, transactionId);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ transaction, splits });
  } catch (err: any) {
    console.error('[routes/splits] GET error:', err);
    res.status(500).json({ error: err?.message || 'Failed to fetch splits' });
  }
});

export default router;

